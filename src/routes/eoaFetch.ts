import { OpenAPIRoute } from "chanfana";
import { sha256 } from "hono/utils/crypto";
import invariant from "tiny-invariant";
import { z } from "zod";
import { decrypt, getCryptoKey } from "../lib/aes-256-gcm";
import { getAccount } from "../lib/eoa";
import {
	type AppContext,
	EncryptedPayloadSchema,
	EncryptionKeySchema,
	EOA,
	UserSaltSchema,
} from "../lib/types";

export class EOAFetch extends OpenAPIRoute {
	schema = {
		summary: "Get a previously created EOA by public address",
		request: {
			headers: z.object({
				"x-encryption-secret": z.preprocess(
					(value) => (value === null ? undefined : value),
					z
						.string()
						.meta({
							description:
								"User provided optional override for symmetric encryption key (256-bit Base85 string)",
						})
						.refine((value) => EncryptionKeySchema.safeParse(value).success, {
							message:
								"Encryption secret must be a valid 256-bit Base85 string",
						})
						.optional(),
				),
				"x-salt": z.preprocess(
					(value) => (value === null ? undefined : value),
					z
						.string()
						.meta({
							description:
								"User provided optional override salt (Base85 string, ≥16 characters, ≤255). Must match the salt used during creation",
						})
						.refine((value) => UserSaltSchema.safeParse(value).success, {
							message:
								"Salt must be a valid Base85 string of at least 16 characters (or empty to use the server salt)",
						})
						.optional(),
				),
			}),
			params: z.object({
				address: z.string().meta({ description: "public address" }),
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
			"403": {
				description:
					"EOA exists but could not be decrypted with the provided x-encryption-secret. This distinction from 404 is intentional: it tells a legitimate user their wallet is still stored while their credential is wrong. It is only reachable with the correct salt",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
							code: z.literal("FOUND_BUT_LOCKED"),
						}),
					},
				},
			},
			"404": {
				description:
					"EOA not found: wrong address, wrong salt, or the record has expired",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();

		// Retrieve the validated slug and query params
		const { "x-encryption-secret": userEncryptionSecret, "x-salt": userSalt } =
			data.headers;
		const { address: publicKey } = data.params;

		if (userEncryptionSecret) {
			invariant(
				EncryptionKeySchema.safeParse(userEncryptionSecret).success,
				"Encryption secret must be a valid 256-bit Base85 string",
			);
		}
		if (userSalt) {
			invariant(
				UserSaltSchema.safeParse(userSalt).success,
				"Salt must be a valid Base85 string of at least 16 characters",
			);
		}

		// get EOA from KV
		const salt = userSalt || c.env.SALT;
		const hash = await sha256(`${salt}${publicKey}`);
		const encryptedPayload = await c.env.WALLET_SECRETS.get(hash, "json");

		if (!encryptedPayload) {
			return c.json({ error: "EOA not found" }, 404);
		}

		const valid = EncryptedPayloadSchema.safeParse(encryptedPayload);
		if (!valid.success) {
			return c.json(null, 400);
		}

		// decrypt private key with AES-256-GCM
		const encryptionKey = userEncryptionSecret || c.env.ENCRYPTION_KEY_256_BIT;
		invariant(
			EncryptionKeySchema.safeParse(encryptionKey).success,
			"ENCRYPTION_KEY_256_BIT must be a valid 256-bit Base85 string",
		);

		try {
			const key = await getCryptoKey(encryptionKey);
			const { iv, ciphertext, expiresAfter } = valid.data;
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
				expiresAfter,
			});
		} catch (_error) {
			const total_eoa_failed_to_decrypt = await c.env.WALLET_SECRETS.get(
				"failed_to_decrypt_counter",
			);
			await c.env.WALLET_SECRETS.put(
				"failed_to_decrypt_counter",
				(Number(total_eoa_failed_to_decrypt ?? 0) + 1).toString(),
			);

			// 403 (not 404) is an intentional, documented signal: the record exists
			// but the provided encryption secret is wrong. It is only reachable with
			// the correct salt, and user salts have an entropy floor, so this cannot
			// cheaply confirm dictionary salt guesses.
			return c.json(
				{
					error: "EOA found but the provided encryption secret could not decrypt it",
					code: "FOUND_BUT_LOCKED",
				},
				403,
			);
		}
	}
}
