import { OpenAPIRoute, Str } from "chanfana";
import { sha256 } from "hono/utils/crypto";
import invariant from "tiny-invariant";
import { z } from "zod";
import { decrypt, getCryptoKey } from "../lib/aes-256-cgm";
import { getAccount } from "../lib/eoa";
import {
	type AppContext,
	EncryptedPayloadSchema,
	EncryptionKeySchema,
	EOA,
	SaltSchema,
} from "../lib/types";

export class EOAFetch extends OpenAPIRoute {
	schema = {
		summary: "Get a previously created EOA by public address",
		request: {
			headers: z.object({
				"x-encryption-secret": z.preprocess(
					(value) => (value === null ? undefined : value),
					Str({
						description:
							"User provided optional override for symmetric encryption key (256-bit Base85 string)",
						required: false,
					})
						.refine((value) => EncryptionKeySchema.safeParse(value).success, {
							message: "Encryption secret must be a valid 256-bit Base85 string",
						})
						.optional(),
				),
			}),
			params: z.object({
				address: Str({ description: "public address" }),
			}),
			query: z.object({
				salt: Str({ description: "<=255 character Base 64 salt" })
					.default("")
					.refine((value) => value.length <= 255, {
						message: "Salt must be less than 255 characters",
					})
					.refine((value) => SaltSchema.safeParse(value).success, {
						message: "Salt must be a valid Base64 string",
					}),
			}),
		},
		responses: {
			"200": {
				description: "Returns an EOA if found",
				content: {
					"application/json": {
						schema: EOA,
					},
				},
			},
			"404": { description: "EOA not found" },
		},
	};

	async handle(c: AppContext) {
		invariant(c.env.WALLET_SECRETS, "WALLET_SECRETS is required");
		invariant(c.env.SALT, "SALT is required");
		invariant(
			SaltSchema.safeParse(c.env.SALT).success,
			"SALT must be a valid Base64 string",
		);

		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		// Retrieve the validated slug and query params
		const { "x-encryption-secret": userEncryptionSecret } = data.headers;
		const { address: publicKey } = data.params;
		const { salt: userSalt } = data.query;

		if (userEncryptionSecret) {
			invariant(
				EncryptionKeySchema.safeParse(userEncryptionSecret).success,
				"Encryption secret must be a valid 256-bit hex string",
			);
		}

		// get EOA from KV
		const salt = userSalt || c.env.SALT;
		const hash = await sha256(`${salt}${publicKey}`);
		const encryptedPayload = await c.env.WALLET_SECRETS.get(hash, "json");

		if (!encryptedPayload) {
			return c.notFound();
		}

		const valid = EncryptedPayloadSchema.safeParse(encryptedPayload);
		if (!valid.success) {
			return c.json(null, 400);
		}

		// decrypt private key with AES-256-GCM
		const encryptionKey = userEncryptionSecret || c.env.ENCRYPTION_KEY_256_BIT;
		invariant(
			EncryptionKeySchema.safeParse(encryptionKey).success,
			"ENCRYPTION_KEY_256_BIT must be a valid 256-bit hex string",
		);

		const key = await getCryptoKey(encryptionKey);
		const { iv, ciphertext } = valid.data;
		const plaintext = await decrypt(key, { iv, ciphertext });
		const pk = new TextDecoder().decode(plaintext);

		const total_eoa_retrieved =
			await c.env.WALLET_SECRETS.get("retrieved_counter");
		await c.env.WALLET_SECRETS.put(
			"retrieved_counter",
			(Number(total_eoa_retrieved ?? 0) + 1).toString(),
		);

		return EOA.parse({
			address: getAccount(`0x${pk.replace("0x", "")}`).address,
			pk,
		});
	}
}
