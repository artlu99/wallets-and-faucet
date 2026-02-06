import { decode as b85decode } from "@alttiri/base85";
import { Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const EOA = z.object({
	address: Str({ example: "0x..." }),
	pk: Str({ example: "0x..." }),
	mnemonic: Str({ example: "word1 word2 word3 ... word24" }).optional(),
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

const HexStringSchema = z.string().regex(/^[0-9a-fA-F]+$/);

export const EncryptedPayloadSchema = z.object({
	iv: HexStringSchema,
	ciphertext: HexStringSchema,
});

export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;
