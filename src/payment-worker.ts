import { createFacilitatorConfig } from "@coinbase/x402";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
	bazaarResourceServerExtension,
	declareDiscoveryExtension,
} from "@x402/extensions/bazaar";
import { paymentMiddleware } from "@x402/hono";
import { Hono } from "hono";
import { getAddress } from "viem";
import { validatePaymentWorkerConfig } from "./lib/config";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", async (c, next) => {
	validatePaymentWorkerConfig(c.env);

	const shortCircuitPayment = c.env.SHORT_CIRCUIT_PAYMENT !== "false";
	if (shortCircuitPayment) {
		return next();
	}

	const routes = {
		"GET /eoa/*": {
			accepts: [
				{
					scheme: "exact",
					network: "eip155:8453" as const,
					payTo: getAddress(c.env.PAYTO_ADDRESS),
					price: "$0.10",
				},
			],
			description: "Get previously created private key",
			extensions: {
				// Declare discovery metadata for Bazaar
				...declareDiscoveryExtension({
					output: {
						example: {
							address: "0x1234567890123456789012345678901234567890",
							pk: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
							mnemonic:
								"abandon ability able about above absent absorb abstract absurd abuse access accident", // optional
						},
						schema: {
							type: "object",
							properties: {
								address: {
									type: "string",
									description:
										"EVM wallet address (0x-prefixed, EIP-55 mixed case)",
									pattern: "^0x[a-fA-F0-9]{40}$",
								},
								pk: {
									type: "string",
									description: "Private key (0x-prefixed hex, 64 chars)",
									pattern: "^0x[a-fA-F0-9]{64}$",
								},
								mnemonic: {
									type: "string",
									description:
										"BIP39 mnemonic phrase (24 words, space-separated, optional)",
								},
							},
							required: ["address", "pk"],
						},
					},
				}),
			},
		},
	};
	const facilitator = new HTTPFacilitatorClient(
		createFacilitatorConfig(c.env.CDP_API_KEY_ID, c.env.CDP_API_KEY_SECRET),
	);
	const server = new x402ResourceServer(facilitator).register(
		"eip155:8453",
		new ExactEvmScheme(),
	);

	// Register bazaar extension for discovery
	server.registerExtension(bazaarResourceServerExtension);

	return paymentMiddleware(routes, server)(c, next);
});

app.all("/*", (c) => c.json({ success: true }, 200));

export default app;
