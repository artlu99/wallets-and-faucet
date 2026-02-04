import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../lib/aes-256-cgm";

describe("aes-256-cgm", async () => {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode("test-key".repeat(4)),
		{ name: "AES-GCM" },
		false,
		["encrypt", "decrypt"],
	);

	it("should encrypt and decrypt a message", async () => {
		const message = "Hello, world!";
		const { iv, ciphertext } = await encrypt(
			key,
			new TextEncoder().encode(message),
		);
		const plaintextUInt8Array = await decrypt(key, { iv, ciphertext });
		const plaintext = new TextDecoder().decode(plaintextUInt8Array);
		expect(plaintext).toEqual(message);
	});
});
