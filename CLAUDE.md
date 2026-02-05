# Wallets and Faucet API

## Purpose

Serverless API that creates **EVM EOAs** (based on ECDSA secp256k1 public-private keypairs). They are stored in KV for a time period, gated by x402 payment for retrieval of the private key. Stored using AES-256-GCM for end-to-end encryption, and salted+hashed keys. Users may optionally supply their own **salt** (Base85, ≤255 chars) and optional **encryption secret** (40-char Base85 = 256-bit key). Free to create addresses, and a free convenience endpoint to generate ephemeral secrets.

## Runtime and tooling

- **Runtime**: Cloudflare Workers (no Node/Bun in production). Local dev: `bun run dev` (wrangler dev).
- **Package manager / runner**: Prefer **Bun** for install and scripts (`bun install`, `bun run dev`, `bunx`). Tests use **Vitest** with `@cloudflare/vitest-pool-workers` (see `vitest.config.ts`); run with `bunx vitest` (or add a `test` script).
- **Architecture**: Two-worker split. Main worker handles wallet operations; separate x402 payment worker handles payment validation. Communication via Cloudflare service binding (`PAYMENT_WORKER`).
- **Types**: `wrangler.jsonc` and generated `worker-configuration.d.ts` define **Env** (bindings, vars). Regenerate with `bun run wrangler:types` after changing wrangler config.

## Project layout

- **`src/index.ts`**: Hono app, Chanfana `fromHono(app, …)`, x402 `paymentMiddleware` for gated routes, Scalar docs, `/llms.txt` (OpenAPI-as-markdown). Do **not** chain Hono’s `.use()` off the Chanfana `openapi` proxy—it breaks typing and route registration.
- **`src/routes/`**: One file per route/feature; each exports a class extending **Chanfana `OpenAPIRoute`** with `schema` and `handle(c: AppContext)`.
- **`src/lib/`**: Shared logic—`types.ts` (Zod: `EOA`, `SaltSchema`, `EncryptionKeySchema`, `EncryptedPayloadSchema`), `config.ts` (x402/env validation, human-readable TTL/price), `aes-256-cgm.ts`, `eoa.ts`, `random.ts`, `try.ts`.
- **`src/test/`**: Vitest tests; `env.d.ts` augments Cloudflare test env with `Env`. Use the Workers pool and wrangler config as in `vitest.config.ts`.

## Stack and key choices

- **HTTP**: **Hono** only (no Express). App type: `Hono<{ Bindings: Env }>`.
- **OpenAPI**: **Chanfana** (`fromHono`). Register routes with `openapi.get/post(…, RouteClass)`. Use **Zod** in `schema` for request/response; for optional headers use `z.preprocess((v) => v === null ? undefined : v, Str(…).optional())` so missing headers (null) don’t fail validation. For **Scalar** or **openapi-to-markdown**, pass a **plain JSON OpenAPI document** (e.g. `(openapi as unknown as { schema: OpenAPI.Document }).schema`), not the Chanfana proxy, to avoid DataCloneError in Workers.
- **Payments**: Separate **x402 worker** deployed independently. Main worker validates x402 config via `validateX402Config()` and forwards gated requests to `PAYMENT_WORKER` service binding. Payment worker returns 402 (payment required) or 200 (authorized). The main worker does **not** use `x402-hono` middleware directly; it implements the forwarding manually in `src/index.ts`.
- **Storage**: **KV** binding `WALLET_SECRETS`; keys derived from salt + address (e.g. hash). TTL from env (`TTL`).
- **Crypto**: AES-256-GCM in `lib/aes-256-cgm.ts`; viem for hex/keys. **Salt and user encryption secret are Base85** (validated with `@alttiri/base85` decode), not Base64. Encryption key: **40-character Base85** string (256-bit key).

## Conventions

- **Context**: Use `AppContext` from `lib/types` (Hono `Context<{ Bindings: Env }>`).
- **Validation**: Use shared Zod schemas from `lib/types` (e.g. `SaltSchema`, `EncryptionKeySchema`) in route `schema` and in handlers; keep a single source of truth (e.g. stats route descriptions match: ≤255 Base85 salt, 40-char Base85 for key).
- **Errors**: Use **Hono `HTTPException`** for 4xx (e.g. 400); use **`c.notFound()`** for 404 where appropriate. Ensure `app.onError` returns `err.getResponse()` for `HTTPException`.
- **Responses**: Successful JSON responses return the **resource directly** (e.g. EOA shape) without a wrapping `{ success: true, … }` for client/React Query simplicity.
- **Optional headers in OpenAPI**: Use Chanfana’s `required: false` on `Str()` **and** `.optional()` (and preprocess null→undefined for headers) so the spec and runtime both treat the header as optional.

## Config and env

- **Wrangler**: `wrangler.jsonc`—`vars` (e.g. `TTL`, `CHARGE_PER_REQUEST`), KV namespace `WALLET_SECRETS`, optional `assets`. Secrets (e.g. `ENCRYPTION_KEY_256_BIT`, `SALT`, `FACILITATOR_URL`, `PAYTO_ADDRESS`) in **`.dev.vars`** (see `.dev.vars.example`); never commit real secrets.
- **Validation**: Call `validateX402Config(c.env)` (or equivalent) before using payment-related env in gated routes.

## Testing

- Run tests with **Vitest** (e.g. `bunx vitest`), using the Workers pool and `wrangler.jsonc`. Use `import("cloudflare:test")` and `ProvidedEnv` extending `Env` when needed.
- Tests live under `src/test/`; reference `lib/types` and route behavior, not Chanfana/x402 internals.

## Do / don’t

- **Do** register routes with `openapi.get/post(…, RouteClass)` in separate statements; **don’t** chain `.use()` on the Chanfana proxy.
- **Do** pass a plain JSON OpenAPI document to Scalar / `createMarkdownFromOpenApi`; **don’t** pass the Chanfana proxy (or any object that might contain the Hono app).
- **Do** use **Base85** (and the existing Zod schemas) for salt and user encryption secret; **don’t** document or validate them as Base64 in new code.
- **Do** use x402 route patterns like `"GET /eoa/[address]"` in `RoutesConfig`; **don’t** use Hono path syntax `:address` there.
- **Do** use `invariant(condition, "message")` for env and critical assumptions; **don’t** throw raw `Error` when an HTTP status is intended (use `HTTPException` or `c.notFound()`).
