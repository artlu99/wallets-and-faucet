import { createFacilitatorConfig } from "@coinbase/x402";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
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
		},
	};
	const facilitator = new HTTPFacilitatorClient(
		createFacilitatorConfig(c.env.CDP_API_KEY_ID, c.env.CDP_API_KEY_SECRET),
	);
	const server = new x402ResourceServer(facilitator).register(
		"eip155:8453",
		new ExactEvmScheme(),
	);

	return paymentMiddleware(routes, server)(c, next);
});

app.all("/*", (c) => c.json({ success: true }, 200));

export default app;
