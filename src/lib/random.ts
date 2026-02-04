import { hexToBytes } from "viem";
import { z } from "zod";

// https://docs.drand.love/dev-guide/developer/http-api
export const BEACON = `https://api.drand.sh/v2/beacons/quicknet/rounds/latest`;
const BeaconSchema = z.object({ round: z.number(), signature: z.string() });

export function randomBytes(n: number): Uint8Array {
	const bytes = new Uint8Array(n);

	// use WebCrypto API in Cloudflare Workers
	crypto.getRandomValues(bytes);
	return bytes;
}

export async function mix(bytes: Uint8Array): Promise<Uint8Array> {
	const response = await fetch(BEACON);
	const data = await response.json();
	const parsed = BeaconSchema.safeParse(data);

	if (!parsed.success) {
		throw new Error(`Failed to parse beacon: ${parsed.error.message}`);
	}

	const { round, signature } = parsed.data;
	console.info(`Beacon round: ${round}`);
	``;

	const signatureBytes = hexToBytes(signature as `0x${string}`);

	// SHA-256 via Web Crypto (Cloudflare Workers)
	const combined = new Uint8Array(bytes.length + signatureBytes.length);
	combined.set(bytes);
	combined.set(signatureBytes, bytes.length);

	const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
	return new Uint8Array(hashBuffer);
}
