import { entropyToMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";
import { Bool, OpenAPIRoute, Str } from "chanfana";
import { sha256 } from "hono/utils/crypto";
import invariant from "tiny-invariant";
import { bytesToHex, hexToBytes } from "viem";
import { z } from "zod";
import { encrypt, getCryptoKey } from "../lib/aes-256-cgm";
import { getAccount, getRandomPrivateKey } from "../lib/eoa";
import { mix as mixWithBeacon } from "../lib/random";
import {
	type AppContext,
	EncryptionKeySchema,
	EOA,
	SaltSchema,
} from "../lib/types";

export class EOACreate extends OpenAPIRoute {
	schema = {
		summary: "Create a new EOA",
		request: {
			headers: z.object({
				"x-encryption-secret": z.preprocess(
					(value) => (value === null ? undefined : value),
					Str({
						description:
							"User provided optional override for symmetric encryption key (256-bit Base85 string)",
						required: false,
						example: "12345678901234567890123456789012345678901",
					})
						.refine((value) => EncryptionKeySchema.safeParse(value).success, {
							message: "Encryption secret must be a valid 256-bit Base85 string",
						})
						.optional(),
				),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							mix: Bool({
								description:
									"mix generated private key with public randomness beacon",
							}).default(false),
							mnemonic: Bool({ description: "show mnemonic or nah" }).default(
								false,
							),
							salt: Str({ description: "≤255 character Base85 salt" })
								.default("")
								.refine((value) => value.length <= 255, {
									message: "Salt must be less than 255 characters",
								})
								.refine((value) => SaltSchema.safeParse(value).success, {
									message: "Salt must be a valid Base85 string",
								}),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Returns the created EOA",
				content: {
					"application/json": {
						schema: EOA,
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		invariant(c.env.WALLET_SECRETS, "WALLET_SECRETS is required");
		invariant(c.env.SALT, "SALT is required");
		invariant(
			SaltSchema.safeParse(c.env.SALT).success,
			"SALT must be a valid Base64 string",
		);
		invariant(c.env.TTL, "TTL is required");
		invariant(!Number.isNaN(c.env.TTL), "TTL must be a number");

		const data = await this.getValidatedData<typeof this.schema>();
		const { mix: useMix, mnemonic: showMnemonic, salt: userSalt } = data.body;
		const { "x-encryption-secret": userEncryptionSecret } = data.headers;
		if (userEncryptionSecret) {
			invariant(
				EncryptionKeySchema.safeParse(userEncryptionSecret).success,
				"Encryption secret must be a valid 256-bit hex string",
			);
		}

		// generate private key
		const localPrivateKey = getRandomPrivateKey();

		// optionally mix private key with public randomness beacon
		const pk = useMix
			? bytesToHex(await mixWithBeacon(hexToBytes(localPrivateKey)))
			: localPrivateKey;

		const { address } = getAccount(pk);

		// salt + hash public key for keyed storage in KV
		const salt = userSalt || c.env.SALT;
		const hash = await sha256(`${salt}${address}`);

		// encrypt private key with AES-256-GCM
		const encryptionKey = userEncryptionSecret || c.env.ENCRYPTION_KEY_256_BIT;
		invariant(
			EncryptionKeySchema.safeParse(encryptionKey).success,
			"ENCRYPTION_KEY_256_BIT must be a valid 256-bit hex string",
		);

		const key = await getCryptoKey(encryptionKey);
		const payload = await encrypt(key, new TextEncoder().encode(pk));

		await c.env.WALLET_SECRETS.put(hash, JSON.stringify(payload), {
			expirationTtl: Number(c.env.TTL),
		});

		const total_eoa_created = await c.env.WALLET_SECRETS.get("created_counter");
		await c.env.WALLET_SECRETS.put(
			"created_counter",
			(Number(total_eoa_created ?? 0) + 1).toString(),
		);

		// Encode private key as BIP39 mnemonic (24 words); restore with mnemonicToEntropy
		const mnemonic = entropyToMnemonic(hexToBytes(pk), englishWordlist);

		return EOA.parse({
			address,
			pk,
			mnemonic: showMnemonic ? mnemonic : undefined,
		});
	}
}
