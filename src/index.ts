import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import type { OpenAPI } from "@scalar/openapi-types";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { validateX402Config } from "./lib/config";
import { EOACreate } from "./routes/eoaCreate";
import { EOAFetch } from "./routes/eoaFetch";
import { EphemeralSecretsRoute } from "./routes/ephemeralRoute";
import { StatsRoute } from "./routes/statsRoute";

const TITLE = "Wallets and Faucet API";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
	docs_url: "/swagger",
	redoc_url: "/redoc",
	openapiVersion: "3.1",
	schema: {
		info: {
			title: TITLE,
			version: "1.0.0",
			description:
				"Generate new EVM keys, and retrieve them for a short period via x402. Stored securely, with cache eviction handled by Cloudflare. Optional and recommended: use ephemeral secrets for additional privacy. Open source and transparent.",
			license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
			contact: { name: "artlu99" },
		},
		externalDocs: {
			url: "https://github.com/artlu99/wallets-and-faucet",
			description: "GitHub repository",
		},
	},
});

// Payment middleware using service binding (x402 is in separate worker)
app.use("/eoa/:address", async (c, next) => {
	validateX402Config(c.env);

	// Forward the request to the payment worker
	const paymentWorker = c.env.PAYMENT_WORKER;
	const url = new URL(c.req.url);
	const paymentUrl = new URL(url.pathname + url.search, "http://payment-worker");

	const paymentResponse = await paymentWorker.fetch(
		new Request(paymentUrl, {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: c.req.raw.body,
		}),
	);

	// If payment check passes, continue to the route handler
	if (paymentResponse.ok) {
		return next();
	}

	// Otherwise return the payment response (likely 402 Payment Required)
	return paymentResponse;
});

openapi
	.get("/eoa/:address", EOAFetch)
	.post("/eoa", EOACreate)
	.get("/ephemeral-secrets", EphemeralSecretsRoute)
	.get("/stats", StatsRoute);

const schema = (openapi as unknown as { schema: OpenAPI.Document }).schema;
app.get("/docs", Scalar({ content: schema, pageTitle: TITLE }));
app.get("/llms.txt", async (c) => {
	const markdown = await createMarkdownFromOpenApi(schema);
	return c.text(markdown);
});

export default app;
