import { entropyToMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";
import { Bool, OpenAPIRoute, Str } from "chanfana";
import { sha256 } from "hono/utils/crypto";
import invariant from "tiny-invariant";
import { bytesToHex, hexToBytes } from "viem";
import { z } from "zod";
import { encrypt, getCryptoKey } from "../lib/aes-256-gcm";
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
						example: "xyz789...",
					})
						.refine((value) => EncryptionKeySchema.safeParse(value).success, {
							message:
								"Encryption secret must be a valid 256-bit Base85 string",
						})
						.optional(),
				),
				"x-salt": z.preprocess(
					(value) => (value === null ? undefined : value),
					Str({
						description:
							"User provided optional override salt (≤255 character Base85 string)",
						required: false,
						example: "abcd1234...",
					})
						.refine((value) => SaltSchema.safeParse(value).success, {
							message: "Salt must be a valid Base85 string",
						})
						.optional(),
				),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							mix_entropy_with_public_source: Bool({
								description:
									"mix privately generated key with randomness beacon",
							}).default(false),
							show_mnemonic: Bool({
								description: "show mnemonic phrase in the response",
							}).default(false),
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
		const data = await this.getValidatedData<typeof this.schema>();
		const { "x-encryption-secret": userEncryptionSecret, "x-salt": userSalt } =
			data.headers;
		const {
			mix_entropy_with_public_source: useMixing,
			show_mnemonic: showMnemonic,
		} = data.body;
		if (userEncryptionSecret) {
			invariant(
				EncryptionKeySchema.safeParse(userEncryptionSecret).success,
				"Encryption secret must be a valid 256-bit Base85 string",
			);
		}
		if (userSalt) {
			invariant(
				SaltSchema.safeParse(userSalt).success,
				"Salt must be a valid Base85 string",
			);
		}

		// generate private key
		const localPrivateKey = getRandomPrivateKey();

		// optionally mix private key with public randomness beacon
		const pk = useMixing
			? bytesToHex(await mixWithBeacon(hexToBytes(localPrivateKey)))
			: localPrivateKey;

		const { address } = getAccount(pk);

		// salt + hash public key for keyed storage in KV
		const salt = userSalt || c.env.SALT;
		invariant(
			SaltSchema.safeParse(salt).success,
			"SALT must be a valid Base85 string",
		);
		const hash = await sha256(`${salt}${address}`);

		// encrypt private key with AES-256-GCM
		const encryptionKey = userEncryptionSecret || c.env.ENCRYPTION_KEY_256_BIT;
		invariant(
			EncryptionKeySchema.safeParse(encryptionKey).success,
			"ENCRYPTION_KEY_256_BIT must be a valid 256-bit Base85 string",
		);

		const expirationTtl = Number(c.env.TTL);
		const expiresAfter = Date.now() / 1000 + expirationTtl;
		const key = await getCryptoKey(encryptionKey);
		const payload = await encrypt(key, new TextEncoder().encode(pk));

		await c.env.WALLET_SECRETS.put(hash, JSON.stringify({ ...payload, expiresAfter }), {
			expirationTtl,
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
			expiresAfter,
			mnemonic: showMnemonic ? mnemonic : undefined,
		});
	}
}
