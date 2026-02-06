import { describe, expect, it } from "vitest";
import { EncryptionKeySchema, SaltSchema } from "../lib/types";

describe("salt schema", () => {
	it("should validate", () => {
		expect(SaltSchema.safeParse("").success).toBe(true);
		expect(SaltSchema.safeParse("a35c462d111e47f").success).toBe(true);
		expect(
			SaltSchema.safeParse("+V7Cwq/N8vL48D4Jm2/hOZgV8Y04o8K4pQw=").success,
		).toBe(true);
	});

	it("should validate (empty)", () => {
		expect(SaltSchema.safeParse("").success).toBe(true);
	});

	it("should not validate (too long)", () => {
		expect(SaltSchema.safeParse("1234567890".repeat(25)).success).toBe(true);
		expect(SaltSchema.safeParse("1234567890".repeat(26)).success).toBe(false);
	});
});
describe("encryption key schema", () => {
	it("should validate", () => {
		expect(
			EncryptionKeySchema.safeParse("1234567890123456789012345678901234567890")
				.success,
		).toBe(true);
		expect(
			EncryptionKeySchema.safeParse("937c9e917f0811730c123c1a78aab4e83b28c9b4")
				.success,
		).toBe(true);
	});

	it("should not validate (empty)", () => {
		expect(EncryptionKeySchema.safeParse("").success).toBe(false);
	});

	it("should not validate (not 256-bit)", () => {
		expect(
			EncryptionKeySchema.safeParse(
				"12345678901234567890123456789012345678901234567890123456789012345678901234567890",
			).success,
		).toBe(false);
	});

	it("should not validate (too long)", () => {
		expect(
			EncryptionKeySchema.safeParse(
				"12345678901234567890123456789012345678901234567890123456789012345678901234567890",
			).success,
		).toBe(false);
	});
});
