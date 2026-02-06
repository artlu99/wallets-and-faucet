---
version: 1.0.0
baseUrl: https://wallets-and-faucet.uk
pinned: https://wallets-and-faucet.eth.limo
---

# Create Staged EOA Wallet

Generate EVM wallets on-demand. Get an address immediately; retrieve the private key later with nominal x402 payment (currently 0.10 USDC). Auto-expires after 7 days.

**Base URL**: `https://wallets-and-faucet.uk` (or self-hosted URL)

> **Note**: The default URL collects x402 payments at `wallets-and-faucet.eth` and serves the frontend permanently via IPFS at `https://wallets-and-faucet.eth.limo`. Self-host to collect fees yourself.

> **Open source & self-hostable**: [github.com/artlu99/wallets-and-faucet](https://github.com/artlu99/wallets-and-faucet)

**Full OpenAPI spec**: Available at `/docs` (Scalar UI), `/redoc` (ReDoc), `/swagger` (Swagger UI), or `/llms.txt` (Markdown)

---

## Critical Gotchas (Read First)

1. **Creating is FREE, retrieving costs money** - `POST /eoa` returns `{ address, pk }` immediately with no payment. Only `GET /eoa/{address}` requires x402 payment.

2. **Private key storage expires** - Wallets are stored with a time-to-live (TTL). Query `GET /status` for the `time_to_deletion` field to see how long private keys remain available. Default is 7 days.

3. **Custom encryption** - If you create a wallet with `x-encryption-secret` and `x-salt` headers, you **MUST** use the exact same values to retrieve. Server can't help you if you lose them.

4. **Private key IS returned on creation** - The `POST /eoa` response includes `pk` (private key). You don't need to pay x402 unless you're retrieving later.

5. **Use `GET /ephemeral-secrets` for privacy** - Returns one-time `salt` + `encryption_secret`. Save both - you'll need them to retrieve wallet details before the storage expires.

6. **x402 payment headers** - Initial `GET /eoa/{address}` returns 402 with `PAYMENT-REQUIRED` header. Use `@x402/core` SDK to process payment and retry with `x-payment` header.

---

## Endpoints

### `POST /eoa` - Create wallet (Free)
**Operation ID**: `post_EOACreate`

**Request body** (optional):
```json
{
  "mix_entropy_with_public_source": false,  // Mix with drand beacon
  "show_mnemonic": false                    // Return BIP39 mnemonic
}
```

**Headers** (optional):
- `x-encryption-secret`: Custom 256-bit Base85 key (40 chars)
- `x-salt`: Custom Base85 salt (≤255 chars)

**Response**: `{ address, pk, mnemonic? }`

**Required**: `address`, `pk`
**Optional**: `mnemonic` (only if `show_mnemonic: true`)

---

### `GET /eoa/{address}` - Retrieve wallet (Requires x402)
**Operation ID**: `get_EOAFetch`

**Path**: `address` (the 0x... address from creation)

**Headers**:
- `x-encryption-secret`: Must match creation (if used)
- `x-salt`: Must match creation (if used)
- `x-payment`: x402 payment token (required)

**Response**: `{ address, pk, mnemonic? }`

**Status codes**:
- `200` - Success
- `402` - Payment required (missing/invalid `x-payment`)
- `404` - Wallet expired or never created
- `500` - Decryption failed (wrong encryption key/salt)

---

### `GET /ephemeral-secrets` - Generate one-time encryption secrets
**Operation ID**: `get_EphemeralSecretsRoute`

**Response**: `{ salt, encryption_secret, independent, mixed }`

Use for enhanced privacy. **Save the values** - you'll need them to retrieve.

---

### `GET /status` - API stats
**Operation ID**: `get_StatusRoute`

**Response**: Current stats including `x402_price`, `time_to_deletion`, counters.

Check this for current pricing and `time_to_deletion` (how long private keys remain available) before paying for retrieval.

---

### `GET /build-info` - Deployment metadata
**Operation ID**: `get_BuildInfoRoute`

**Response**: `{ commit_sha, commit_short, commit_timestamp, branch, build_timestamp, build_run_id, build_run_url }`

Useful for verifying what code is deployed.

---

## x402 Payment Flow

The API uses the x402 protocol for paid retrieval.

1. **First request** returns 402 with payment requirements:
```http
PAYMENT-REQUIRED: {"amount":"0.1","currency":"USDC","chainId":"8453","to":"0x..."}
PAYMENT-REQUIRED-SIGNATURE: base64_signature
```

2. **Process payment** using `@x402/core` SDK:
```javascript
import { PaymentManager } from '@x402/core';
import { evm } from '@x402/evm';

const paymentManager = new PaymentManager({ chains: [evm] });
const headers = await paymentManager.attachPaymentHeaders({ /* from PAYMENT-REQUIRED */ });
```

3. **Retry with `x-payment` header** from SDK.

See [x402 docs](https://www.x402.org/) or [example script](https://github.com/artlu99/wallets-and-faucet/blob/main/src/test/test-onchain-payment-flow.ts).

---

---

## Common Workflows

### Quick create (server encryption)
```javascript
const wallet = await fetch('https://wallets-and-faucet.uk/eoa', { method: 'POST' }).then(r => r.json());
// You now have wallet.address and wallet.pk
// Save the address if you want to retrieve later (costs x402)
```

### Privacy-enhanced (ephemeral secrets)
```javascript
// 1. Get secrets
const { salt, encryption_secret } = await fetch('https://wallets-and-faucet.uk/ephemeral-secrets').then(r => r.json());

// 2. Create wallet
const wallet = await fetch('https://wallets-and-faucet.uk/eoa', {
  method: 'POST',
  headers: { 'x-salt': salt, 'x-encryption-secret': encryption_secret }
}).then(r => r.json());

// 3. IMPORTANT: Save salt and encryption_secret for retrieval
// You'll need them + x-payment to retrieve later
```

### Retrieve with x402
```javascript
const response = await fetch(`https://wallets-and-faucet.uk/eoa/${address}`, {
  headers: {
    'x-salt': savedSalt,           // Must match creation
    'x-encryption-secret': savedKey, // Must match creation
    'x-payment': await paymentManager.attachPaymentHeaders(/* ... */)
  }
});
const { address, pk } = await response.json();
```

---

## Encryption & Salting

**Default** (no headers): Server encrypts with its own key. No secrets to save.

**Custom encryption** (headers provided): You control encryption. Server can't recover wallet if you lose `x-encryption-secret` or `x-salt`.

**Ephemeral secrets** (`https://wallets-and-faucet.uk/ephemeral-secrets`): One-time keys generated by server. Enhanced privacy, but you must save them.

---

## Error Handling

| Status | Meaning | Fix |
|--------|---------|-----|
| 404 | Wallet not found/expired | Check address, check TTL (7 days) |
| 402 | Payment required | Process x402 payment, add `x-payment` header |
| 500 | Decryption failed | Wrong `x-encryption-secret` or `x-salt` |
| 400 | Bad request | Invalid encryption key format (40-char Base85) or salt (≤255 chars Base85) |

---

## Data Types Reference

**Encryption key**: 40-character Base85 string (256-bit key)
**Salt**: ≤255 character Base85 string
**Address**: 0x-prefixed hex string (40 chars, EIP-55 mixed case)
**Private key**: 0x-prefixed hex string (64 chars)
**Mnemonic**: 24-word BIP39 phrase (space-separated)

---

## Testing Locally

Self-hosting instructions available at [Github](https://github.com/artlu99/wallets-and-faucet/blob/main/SELF-HOSTING.md).

---

## Summary

- **Create**: `POST /eoa` → returns `{ address, pk }` (free)
- **Retrieve**: `GET /eoa/{address}` with `x-payment` → returns `{ address, pk }` (costs money)
- **Privacy**: Use `/ephemeral-secrets` + custom headers
- **Pricing & TTL**: Check `/status` for current `x402_price` and `time_to_deletion` (how long private keys remain stored)
- **Version**: Check `/build-info` for deployed code
- **Full spec**: `/swagger`, `/docs`, or `/redoc`

For detailed schemas and interactive testing, use `/docs` (Scalar UI).
