import { decode as b85decode } from "@alttiri/base85";
import invariant from "tiny-invariant";
import { bytesToHex, type Hex, hexToBytes } from "viem";
import {
	type EncryptedPayload,
	type EncryptionKey,
	EncryptionKeySchema,
} from "./types";

export const getCryptoKey = async (key: EncryptionKey): Promise<CryptoKey> => {
	invariant(
		EncryptionKeySchema.safeParse(key).success,
		"ENCRYPTION_KEY_256_BIT must be a valid 256-bit hex string",
	);

	return await crypto.subtle.importKey(
		"raw",
		b85decode(key),
		{ name: "AES-GCM" },
		false,
		["encrypt", "decrypt"],
	);
};

// Encrypt: key (CryptoKey), plaintext (Uint8Array) → { iv, ciphertext }
export const encrypt = async (
	key: CryptoKey,
	plaintext: Uint8Array,
): Promise<EncryptedPayload> => {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv, tagLength: 128 },
		key,
		plaintext,
	);
	return {
		iv: bytesToHex(iv).replace("0x", ""),
		ciphertext: bytesToHex(new Uint8Array(ciphertext)).replace("0x", ""),
	};
};

// Decrypt: key (CryptoKey), iv (hex string), ciphertext (hex string) → plaintext (Uint8Array)
export const decrypt = async (
	key: CryptoKey,
	payload: EncryptedPayload,
): Promise<Uint8Array> => {
	const { iv, ciphertext } = payload;
	return new Uint8Array(
		await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: hexToBytes(`0x${iv.replace("0x", "")}` as Hex),
				tagLength: 128,
			},
			key,
			hexToBytes(`0x${ciphertext.replace("0x", "")}` as Hex),
		),
	);
};
