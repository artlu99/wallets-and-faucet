import { formatDistance } from "date-fns";
import invariant from "tiny-invariant";
import { EncryptionKeySchema, SaltSchema } from "./types";

export function validateConfig(env: Env): void {
	invariant(env.SALT, "SALT is required");
	invariant(
		SaltSchema.safeParse(env.SALT).success,
		"SALT must be a valid Base85 string",
	);

	invariant(env.ENCRYPTION_KEY_256_BIT, "ENCRYPTION_KEY_256_BIT is required");
	invariant(
		EncryptionKeySchema.safeParse(env.ENCRYPTION_KEY_256_BIT).success,
		"ENCRYPTION_KEY_256_BIT must be a valid 256-bit Base85 string",
	);

	invariant(env.TTL, "TTL is required");
	invariant(!Number.isNaN(Number(env.TTL)), "TTL must be a number");
	invariant(
		Number(env.TTL) > 60,
		"TTL must be greater than 60 (Cloudflare KV TTL limit)",
	);

	invariant(env.CHARGE_PER_REQUEST, "CHARGE_PER_REQUEST is required");
}

export function validatePaymentWorkerConfig(env: Env): void {
	invariant(env.SHORT_CIRCUIT_PAYMENT, "SHORT_CIRCUIT_PAYMENT is required");

	invariant(
		env.CHARGE_PER_REQUEST === "0.1",
		"check hard-coded $0.10 in payment worker route",
	);

	invariant(env.CDP_API_KEY_ID, "CDP_API_KEY_ID is required");
	invariant(env.CDP_API_KEY_SECRET, "CDP_API_KEY_SECRET is required");

	invariant(env.PAYTO_ADDRESS, "PAYTO_ADDRESS is required");
}

export function humanReadableTtl(ttlInSeconds: number): string {
	return formatDistance(
		Date.now() + Number(ttlInSeconds) * 1000, // 1 day in milliseconds
		new Date(),
		{ addSuffix: true },
	);
}

export function humanReadableChargePerRequest(
	chargePerRequest: number,
): string {
	return chargePerRequest.toLocaleString(undefined, {
		style: "currency",
		currency: "USD",
	});
}
