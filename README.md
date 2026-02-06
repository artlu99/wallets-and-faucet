# Wallets and Faucet

![Wallets and Faucet](https://cdn.artlu.xyz/2P9f4NpaUBk)

A permissionless API for [trustless](https://trustlessness.eth.limo/general/2025/11/11/the-trustless-manifesto.html) creation and retrieval of EVM accounts (EOAs). Designed for agentic workflows: create fresh wallets; choose from a spectrum of trust assumptions; be freed from temptation to persist secrets where future agents may access them.

Keys are delivered immediately, and stored encrypted for a short period. Retrieving a private key by its public address is gated by an [x402](https://x402.org) payment to cover storage costs, and optionally by user-provided secrets that the server never stores. All code is open source. Storage is provided at arm's length and secure removal is guaranteed by Cloudflare.

[*Easter Egg*](https://wallets-and-faucet.eth.limo/#yay)

---

## Quickstart

### How It Works

1. **Create** a new wallet (free!) — you receive the address and private key immediately
2. The private key is **encrypted** with AES-256-GCM and stored in secure KV storage
3. **Retrieve** the private key later (requires x402 payment) — useful if you lose the key
4. After a time period (TTL), the private key is **automatically deleted**

All wallets are stored with end-to-end encryption. For additional privacy (optional, but highly recommended), you can generate ephemeral secrets to provide as your own salt and encryption key.

---

## Endpoints

### 1. Create a Wallet (Free)
```bash
POST /eoa
```

Creates a new EVM wallet with a fresh private key.

**Request Body:**
```json
{
  "mix_entropy_with_public_source": false,        // Optional: mix private key with public randomness beacon
  "show_mnemonic": false    // Optional: include BIP39 mnemonic phrase in response
}
```

**Optional Headers:**
```
x-encryption-secret: <40-char Base85 string>
x-salt: <Base85 string, ≤255 chars>
```
Provide your own encryption key and/or salt instead of the server defaults.

**Response (200):**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "pk": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
}
```

If `"mnemonic": true`, you also get:
```json
{
  "mnemonic": "word1 word2 word3 ... word24"
}
```

---

### 2. Retrieve a Wallet (Paid)
```bash
GET /eoa/:address
```

Retrieves a previously created wallet's private key. Requires **x402 payment** (402 Payment Required).

**Path Parameters:**
- `address` — The wallet's public address

**Optional Headers:**
```
x-encryption-secret: <same 40-char Base85 string used during creation>
x-salt: <same salt used when creating the wallet>
```
Provide the same encryption secret and salt used during wallet creation (or omit both if using server defaults).

**Payment:**
This endpoint is protected by **x402**. You'll receive a 402 response with payment instructions. Complete the payment and retry to retrieve the private key.

---

### 3. Generate Ephemeral Secrets (Free)
```bash
GET /ephemeral-secrets
```

Generate a random salt and encryption key for one-time use. Providing your own secrets adds an extra layer of protection beyond the payment requirement.

**Response (200):**
```json
{
  "salt": "1234567890abcd",
  "encryption_secret": "1234567890123456789012345678901234567890",
  "independent": true,
  "mixed": false
}
```

**Usage:**
1. Call this endpoint to get fresh secrets
2. Use them when creating a wallet (provide `x-salt` and `x-encryption-secret` headers)
3. Store them securely — you'll need them again to retrieve the wallet!

---

### 4. API Status (Free)
```bash
GET /status
```

View API statistics and configuration.

---

## Security & Privacy

### Encryption
- Private keys are encrypted with **AES-256-GCM** before storage
- The server never sees plaintext private keys
- Highly suggested: provide your own encryption key via `x-encryption-secret` header

### Salting
- Storage keys are derived from `salt + address` (hashed with SHA-256)
- Use your own salt to prevent correlation attacks
- Salt must be a **Base85** string (more information-dense than Base64), ≤255 characters

### Ephemeral Secrets
For maximum privacy:
1. Generate fresh secrets from `/ephemeral-secrets`
2. Use them when creating a wallet
3. Never reuse secrets across wallets

Use ephemeral secrets when you need to bridge between a development environment and secure long-term storage, without saving private keys to disk.

---

## Example Workflow

### Basic, Semi-Trusted Usage
```bash
# 1. Create a wallet
curl -X POST https://wallets-and-faucet.uk/eoa \
  -H "Content-Type: application/json" \
  -d '{"show_mnemonic": false}'

# Response: Save the address and pk!
# {"address":"0x...","pk":"0x..."}

# 2. Later, retrieve it (requires x402 payment)
curl https://wallets-and-faucet.uk/eoa/0x...
```

### Privacy-Maximizing, Trustless Usage
```bash
# 1. Generate ephemeral secrets
curl https://wallets-and-faucet.uk/ephemeral-secrets
# {"salt":"abcd1234...","encryption_secret":"xyz789...","independent":true,"mixed":false}

# 2. Create wallet with those secrets
curl -X POST https://wallets-and-faucet.uk/eoa \
  -H "Content-Type: application/json" \
  -H "x-salt: abcd1234..." \
  -H "x-encryption-secret: xyz789..."
  
# 3. Retrieve with the same secrets (after x402 payment)
curl https://wallets-and-faucet.uk/eoa/0x... \
  -H "x-salt: abcd1234..." \
  -H "x-encryption-secret: xyz789..."
```

---

## Important Notes

- Creating wallets **is always free**
- Retrieving private keys **requires x402 payment**
- Private keys are evicted from storage after the TTL period (inspect `/status` for current server duration policy)
- **Interactive use:** Save the private key immediately when creating a wallet
- **Agentic use:** Let agents create wallets without persisting secrets in insecure environments. Retrieve later via paid endpoint if needed. Or, create another wallet using the same free process to deploy to prod, never allowing those secrets to enter insecure memory

---

## Docs

- **Markdown** (for LLMs): `/llms.txt`
- **Interactive docs**: `/docs` (Scalar) | `/redoc` (Redocly) | `/swagger` (Swagger)
- **OpenAPI spec**: `/openapi.json`

For full request/response schemas, use the OpenAPI spec or the interactive docs at `/docs`.

## Self Hosting

Full instructions in [SELF-HOSTING.md](SELF-HOSTING.md).

## License

MIT.
