import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import type { OpenAPI } from "@scalar/openapi-types";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { validateConfig } from "./lib/config";
import { EOACreate } from "./routes/eoaCreate";
import { EOAFetch } from "./routes/eoaFetch";
import { EphemeralSecretsRoute } from "./routes/ephemeralRoute";
import { StatusRoute } from "./routes/statusRoute";

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
	validateConfig(c.env);

	// Forward the request to the payment worker (explicit header copy so X-PAYMENT is not lost)
	const paymentWorker = c.env.PAYMENT_WORKER;
	const url = new URL(c.req.url);
	const paymentUrl = new URL(
		url.pathname + url.search,
		"http://payment-worker",
	);
	const fwdHeaders = new Headers();
	const xPaymentKey = "x-payment";
	// X-PAYMENT must be single-line base64; strip whitespace (e.g. from header folding) so payment worker's atob+JSON.parse succeeds
	c.req.raw.headers.forEach((value, key) => {
		const normalized =
			key.toLowerCase() === xPaymentKey ? value.replace(/\s/g, "") : value;
		fwdHeaders.set(key, normalized);
	});

	const paymentResponse = await paymentWorker.fetch(
		new Request(paymentUrl, {
			method: c.req.method,
			headers: fwdHeaders,
			body: c.req.raw.body,
		}),
	);

	// forward x402 payment headers to client
	if (paymentResponse.ok) {
		const paymentHeaders = new Headers();
		paymentResponse.headers.forEach((value, key) => {
			if (
				key.toLowerCase().startsWith("x-") ||
				key.toLowerCase().startsWith("payment-")
			) {
				paymentHeaders.set(key, value);
			}
		});

		await next();

		// After route handler completes, attach payment headers to the response
		paymentHeaders.forEach((value, key) => {
			c.header(key, value);
		});

		return;
	}

	// Return 402 (or other error) with payment headers explicitly preserved so the client
	// can read PAYMENT-REQUIRED / PAYMENT-RESPONSE (v2 puts requirements in headers).
	const paymentHeaders = new Headers(paymentResponse.headers);
	const body = await paymentResponse.text();
	return new Response(body || undefined, {
		status: paymentResponse.status,
		statusText: paymentResponse.statusText,
		headers: paymentHeaders,
	});
});

openapi
	.get("/eoa/:address", EOAFetch)
	.post("/eoa", EOACreate)
	.get("/ephemeral-secrets", EphemeralSecretsRoute)
	.get("/status", StatusRoute);

const schema = (openapi as unknown as { schema: OpenAPI.Document }).schema;
app.get("/docs", Scalar({ content: schema, pageTitle: TITLE }));
app.get("/llms.txt", async (c) => {
	const markdown = await createMarkdownFromOpenApi(schema);
	return c.text(markdown);
});

export default app;
