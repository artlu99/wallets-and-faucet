import { decode as b85decode } from "@alttiri/base85";
import { Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const EOA = z.object({
	address: Str({ example: "0x1234567890abcdef" }),
	pk: Str({ example: "0x1234567890abcdef" }),
	mnemonic: Str({ example: "word word ... word" }).optional(),
});

export const SaltSchema = z
	.string()
	.refine((value) => value.length <= 255, {
		message: "Salt must be less than 255 characters",
	})
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
	);

export const EncryptionKeySchema = z
	.string()
	.refine((value) => value.length === 40, {
		message: "Encryption key must be 256 bits (40 characters in Base85)",
	})
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
	);

export type EncryptionKey = z.infer<typeof EncryptionKeySchema>;

const HexStringSchema = z.string().regex(/^[0-9a-fA-F]+$/);

export const EncryptedPayloadSchema = z.object({
	iv: HexStringSchema,
	ciphertext: HexStringSchema,
});

export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;
