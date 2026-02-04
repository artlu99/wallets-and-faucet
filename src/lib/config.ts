import { formatDistance } from "date-fns";
import invariant from "tiny-invariant";

export function validateX402Config(env: Env): void {
	invariant(env.CHARGE_PER_REQUEST, "CHARGE_PER_REQUEST is not set");
	invariant(
		!Number.isNaN(Number(env.CHARGE_PER_REQUEST)),
		"CHARGE_PER_REQUEST must be a number",
	);
	invariant(
		Number(env.CHARGE_PER_REQUEST) > 0,
		"CHARGE_PER_REQUEST must be greater than 0",
	);

	invariant(env.TTL, "TTL is not set");
	invariant(!Number.isNaN(Number(env.TTL)), "TTL must be a number");
	invariant(
		Number(env.TTL) > 60,
		"TTL must be greater than 60 (Cloudflare KV TTL limit)",
	);

	invariant(env.PAYTO_ADDRESS, "PAYTO_ADDRESS is not set");
	invariant(env.FACILITATOR_URL, "FACILITATOR_URL is not set");
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
