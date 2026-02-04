# Wallets and Faucet

![Wallets and Faucet](https://i.imgflip.com/aj8v9n.jpg)

An API that creates and retrieves EVM keys (EOAs). Designed to be useful for agentic workflows, creating wallets and never writing valuable secrets to disk in the same context available to the LLM.

Keys are stored encrypted in Cloudflare KV for a short period; retrieving a private key by its public address is gated by a small $0.10 [x402](https://x402.org) payment to cover storage costs. The code is open source; storage is provided at arms-length and secure removal is guaranteed by Cloudflare.

For additional privacy (optional, but **highly recommended**), an agent can request ephemeral secrets (salt and encryption keys) that they can store temporarily on disk. This affords developers some time to retrieve and store the secrets more securely. Durability is handled by the KV cache invalidation mechanism.

## What it does

- **Create** a new EOA (private key + address). Optional: mix entropy with a public beacon, request a BIP39 mnemonic, use a custom salt or encryption key. Free.
- **Fetch** a previously created EOA by its public address and optional salt/encryption key. Requires a small payment of 0.10 $USDC on Base via x402.
- **Ephemeral secrets** — generate a salt and 256-bit encryption key (Base85) for use with create/fetch. Free.
- **Stats** — basic API stats (counts, TTL, price, rules for salt/encryption).

Storage uses AES-256-GCM; salt and optional encryption secret are Base85 (40 chars for the encryption key, up to 255 chars for salt).

*Me and Who* 

![pov: me and claude and all the wallets we made safely](https://cdn.artlu.xyz/2P9V6tSlAQa)


## Docs

- **Markdown** (for LLMs): `/llms.txt`
- **Interactive docs**: `/docs` (Scalar) | `/redoc` (Redocly) | `/swagger` (Swagger)
- **OpenAPI spec**: `/openapi.json`

For full request/response schemas, use the OpenAPI spec or the interactive docs at `/docs`.

## Self Hosting

Full instructions in [SELF-HOSTING.md](/SELF-HOSTING.md).

## License

MIT.
