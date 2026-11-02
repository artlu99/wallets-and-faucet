import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				workers: [
					{
						// Stub for the PAYMENT_WORKER service binding declared in
						// wrangler.jsonc. Unit tests never invoke it; without it,
						// workerd (miniflare 5) fails startup on the unresolved binding.
						// Integration tests that need the real payment worker should run
						// both workers via `wrangler dev -c wrangler.jsonc -c wrangler-payment.jsonc`.
						name: "wallets-payment-worker",
						modules: true,
						script: "export default { fetch() { return new Response('payment worker not available in tests', { status: 501 }); } };",
					},
				],
			},
		}),
	],
});
