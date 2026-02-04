# SELF HOSTING

## Requirements

- [Cloudflare account](https://workers.cloudflare.com) (free tier is enough)
- [Bun](https://bun.sh) (or Node; use `npm`/`pnpm` if you prefer)

## Developing

1. **Install**
```bash
git clone <repo-url>
cd wallets-and-faucet
bun install
bun wrangler:types
   ```

2. **Develop locally**
```bash
bun run dev
```

*N.B.*, `dev` and `prod` KV stores are kept separate by default

3. **Configure secrets**  
   Copy `.dev.vars.example` to `.dev.vars` and fill in values (see [Environment variables](#environment-variables)). Do not commit `.dev.vars`.

4. **Deploy**

Log in to Cloudflare
```bash
bunx wrangler login
```

Deploy
```bash
bun run deploy
```

## Environment variables

**Secrets** (in `.dev.vars` locally; set in Cloudflare dashboard or via `wrangler secret` for production):

| Variable | Description |
|----------|-------------|
| `ENCRYPTION_KEY_256_BIT` | 40-character Base85 string (256-bit key) used as fallback to encrypt keys in KV |
| `SALT` | salt (Base85, ≤255 chars) used as fallback to salt the KV keys |
| `PAYTO_ADDRESS` | EVM address that receives x402 payments |
| `FACILITATOR_URL` | x402 facilitator base URL (e.g. `https://x402.org/facilitator`). |

**Config** (in `wrangler.jsonc` or overridden in dashboard):

| Variable | Description |
|----------|-------------|
| `CHARGE_PER_REQUEST` | Price per paid request (e.g. `0.1` for $0.10). |
| `TTL` | How long keys stay in KV, in seconds (e.g. `900` = 15 minutes, `604800` = 7 days). |

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/eoa` | Create a new EOA. Body: `mix`, `mnemonic`, `salt` (optional). Rcommended header (optional): `x-encryption-secret`. |
| `GET` | `/eoa/:address` | Fetch an EOA by address. **Requires x402 payment.** Query: `salt` (optional). Header (optional): `x-encryption-secret`. |
| `GET` | `/ephemeral-secrets` | Generate ephemeral salt and encryption key (for testing or one-off use). |
| `GET` | `/stats` | API statistics (counts, TTL, price, salt/key rules). |

**Docs and specs**

- **Interactive docs**: `/docs` (Scalar)
- **OpenAPI JSON**: `/doc` (Chanfana default)
- **Markdown** (for LLMs): `/llms.txt`

For full request/response schemas, use the OpenAPI spec or the interactive docs at `/docs`.

## Development

- **Tests**: `bun vitest` (uses Cloudflare Vitest Workers pool).
- **Types**: Regenerate Worker env types with `bun wrangler:types` after changing `wrangler.jsonc`.

## License

MIT.
