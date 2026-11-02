/// <reference types="@cloudflare/vitest-plugin/types" />
declare module "cloudflare:test" {
	// ProvidedEnv controls the type of `import("cloudflare:test").env`
	interface ProvidedEnv extends Env {}
}
