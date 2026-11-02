import { decode as b85decode } from "@alttiri/base85";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const EOA = z.object({
	address: z.string().meta({ example: "0x..." }),
	pk: z.string().meta({ example: "0x..." }),
	expiresAfter: z.number().meta({
		description: "Unix timestamp after which the EOA can expire",
		example: 1772323200,
	}),
	mnemonic: z
		.string()
		.meta({ example: "word1 word2 word3 ... word24" })
		.optional(),
});

export const SaltSchema = z
	.string()
	.refine(
		(value) => {
			if (value === "") return true;
			try {
				// check if base85
				b85decode(value);
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Must be a valid Base85 string" },
	)
	.refine(
		(value) => {
			if (value === "") return true;
			return value.length <= 255;
		},
		{
			message: "Salt must be less than 255 characters",
		},
	);

export const EncryptionKeySchema = z
	.string()
	.refine(
		(value) => {
			try {
				// check if base85
				b85decode(value);
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Must be a valid Base85 string" },
	)
	.refine(
		(value) => {
			const decoded = b85decode(value);
			return decoded.length === 256 / 8;
		},
		{
			message: "Encryption key must be 256 bits (40 characters in Base85)",
		},
	);

export type EncryptionKey = z.infer<typeof EncryptionKeySchema>;

/**
 * Entropy floor for user-provided salts. Short, human-chosen salts are
 * vulnerable to dictionary enumeration through the paid retrieval endpoint,
 * where a 403 (found-but-locked) response confirms a correct salt guess.
 * Empty string remains valid (falls back to the server salt). Generated
 * salts from /ephemeral-secrets are 20 characters (16 random bytes, Base85)
 * and always satisfy this floor.
 */
export const MIN_USER_SALT_LENGTH = 16;

export const UserSaltSchema = SaltSchema.refine(
	(value) => value === "" || value.length >= MIN_USER_SALT_LENGTH,
	{
		message: `Salt must be at least ${MIN_USER_SALT_LENGTH} characters (generate one at /ephemeral-secrets)`,
	},
);

const HexStringSchema = z.string().regex(/^[0-9a-fA-F]+$/);

export const EncryptedPayloadSchema = z.object({
	iv: HexStringSchema,
	ciphertext: HexStringSchema,
	expiresAfter: z
		.number()
		.meta({
			description: "Unix timestamp after which the EOA can expire",
			example: 1772323200,
		})
		.optional(),
});

export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;
