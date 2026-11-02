# Wallets and Faucet

![Wallets and Faucet](https://cdn.artlu.xyz/2P9f4NpaUBk)

A permissionless API for [trustless](https://trustlessness.eth.limo/general/2025/11/11/the-trustless-manifesto.html) creation and retrieval of EVM accounts (EOAs). You can create wallets for agents. You can retrieve a private key later, after you pay. All code is public.

[*Easter Egg*](https://wallets-and-faucet.eth.limo/#yay)

---

## How it works

1. You send a create request. The server makes a new EVM key pair. You get the address and the private key in the response.
2. The server encrypts the private key with AES-256-GCM. The server stores the ciphertext in KV.
3. The KV store removes the record at the end of the TTL.
4. You can retrieve the private key later. Each retrieval needs an x402 payment.

---

## Security axes

The API gives you five choices. Each choice controls one property. You can combine the choices freely.

### The constant

One rule applies to every configuration. The server makes the private key. The server shows the private key in the create response. No choice changes this rule. With self-run, you operate the server on your machine. Then you are the operator. Addresses become public when you use a wallet on a chain. Treat all addresses as public.

### The axes

| Axis | Question it answers | Mechanism |
|------|---------------------|-----------|
| Salt | Who can find the record? | The KV key is `SHA-256(salt + address)`. Your salt hides the location. Base85, 16 to 255 characters. Empty value = server salt. |
| Encryption secret | Who can read the ciphertext? | Your 256-bit key replaces the server key for AES-256-GCM. 40-character Base85. The server does not store it. |
| TTL | Does a stored record exist? | `ttl: 0` means no store. No record, nothing to find or decrypt. |
| Self-host | Who operates the server? | You deploy this code to your own Cloudflare account. |
| Self-run | Does the API touch the network? | `wrangler dev` runs the server on your machine only. |

### Rules of composition

- The salt and the secret are independent. The salt hides the location. The secret protects the content. Use both for the strongest stored configuration.
- `ttl: 0` removes the record. Then the salt and the secret have no function.
- Self-host and self-run are points on one line. The line is: who runs the server.
- A wrong secret fails closed. The server does not fall back to the server key.
- Generate the salt and the secret together. Store them as one unit. Example: one entry in a password manager. Never reuse a pair.

### The matrix

Legend: ✅ protected. ⚠️ partial. ❌ exposed. — no user credential exists.

| Configuration | Stranger with your address | KV dump, no server keys | Operator with logs | Cloudflare | Your secrets leak | You lose your secrets |
|---|---|---|---|---|---|---|
| Defaults | ❌ pay to extract | ✅ | ❌ | ❌ | — | ✅ pay to recover |
| + salt | ⚠️ needs your salt | ✅ | ❌ | ❌ | ⚠️ location exposed | ⚠️ record unreachable |
| + secret | ⚠️ cannot decrypt | ✅ | ❌ | ❌ | ❌ key + address = access | ❌ record unreadable |
| + salt + secret | ✅ needs both, plus $0.10 | ✅ strongest at rest | ❌ | ❌ | ⚠️ one leak is not enough | ❌ |
| `ttl: 0` | ✅ no record exists | ✅ no record exists | ⚠️ server saw the key at creation | ⚠️ | — | ❌ you hold the only copy |
| Self-host, defaults | ❌ same code, pay to extract | ✅ | ⚠️ you are the operator | ❌ still Cloudflare | — | ✅ |
| Self-host + salt + secret | ✅ | ✅ | ⚠️ perfect against others; you hold all pieces | ❌ still Cloudflare | ⚠️ | ❌ |
| Self-run | ✅ no public endpoint | ✅ local disk | ✅ no remote operator | ✅ local runtime | ⚠️ your machine is the perimeter | ❌ |

### Reading the matrix

- The payment does not prove identity. The payment prices each retrieval at $0.10. Your address, your salt, and your secret are the credentials.
- The 16-character salt floor blocks dictionary guessing. A salt guess below the floor cannot confirm a hit.
- Best hosted configuration: a fresh salt and secret pair from `/ephemeral-secrets`, stored as one unit.
- Best overall: `ttl: 0` with the key saved from the create response, or self-run.

---

## Error semantics

The retrieval endpoint returns different errors for different conditions. This is deliberate.

| Status | Code | Meaning | Condition |
|--------|------|---------|-----------|
| `404` | — | Not found | Wrong address, wrong salt, or expired record |
| `403` | `FOUND_BUT_LOCKED` | Found, not decrypted | Correct salt, wrong `x-encryption-secret` |
| `402` | — | Payment required | Missing or invalid `x-payment` header |
| `400` | — | Bad request | Header format does not match the rules |

The `403` response tells you that your record is still stored. Your secret is wrong. Find the correct secret.

---

## Agent Skill

A skill for agents is available at [/create-staged-eoa-wallet](skills/create-staged-eoa-wallet/SKILL.md). Inspect it before you copy it.

---

## Endpoints

### 1. Create a wallet (free)

```bash
POST /eoa
```

**Headers (optional):**
```
x-encryption-secret: <40-char Base85 string>
x-salt: <Base85 string, 16 to 255 chars>
```

**Body:**
```json
{
  "mix_entropy_with_public_source": false,
  "show_mnemonic": false,
  "ttl": 604800
}
```

- `mix_entropy_with_public_source` (default `false`): mix the private key with the beacon signature. The mix is a SHA-256 of your key and the signature.
- `show_mnemonic` (default `false`): add a 24-word BIP39 mnemonic to the response.
- `ttl`: seconds. `0` = do not store. `60` or more = store for this duration. No value = server default.

**Response (200):**
```json
{
  "address": "0x...",
  "pk": "0x...",
  "expiresAfter": 1772323200
}
```

`expiresAfter` is a Unix timestamp. The value `0` means: not stored. Save the `pk` immediately. The server shows it one time.

---

### 2. Retrieve a wallet (paid)

```bash
GET /eoa/:address
```

**Headers (optional):**
```
x-encryption-secret: <same 40-char Base85 string used during creation>
x-salt: <same salt used during creation>
```

- Omit both headers if you used the server defaults at creation.
- The first request returns `402` with payment instructions. Complete the payment and send the request again. See [x402](https://x402.org).

**Response (200):**
```json
{
  "address": "0x...",
  "pk": "0x...",
  "expiresAfter": 1772323200
}
```

See [Error semantics](#error-semantics) for the `400`, `402`, `403`, and `404` conditions.

---

### 3. Generate ephemeral secrets (free)

```bash
GET /ephemeral-secrets
```

**Response (200):**
```json
{
  "salt": "wQ7z9BcK2mNf8vXs4LpR",
  "encryption_secret": "xyz789...",
  "independent": true,
  "mixed": false,
  "storage_advice": "Store salt and encryption_secret together as one unit; they only work as a pair"
}
```

---

### 4. API status (free)

```bash
GET /status
```

Shows statistics and configuration. Check `x402_price` and `time_to_deletion` before you pay for a retrieval.

---

## Rules (quick reference)

| Rule | Value |
|------|-------|
| Creation cost | Free |
| Retrieval cost | $0.10 per request, x402 on Base |
| Salt | Base85, 16 to 255 characters; empty = server salt; shorter salts are not valid |
| Encryption secret | 40-character Base85 (256-bit) |
| Pair storage | One unit; one half alone does not work |
| Storage cipher | AES-256-GCM |
| Storage key | `SHA-256(salt + address)` |
| Default TTL | 7 days (`/status` shows the current value) |
| User TTL | `0` = no store; `60` or more = store |
| Delete operation | None; records expire at the TTL |
| Mnemonic | 24-word BIP39, optional, creation only |

---

## Docs

- **Markdown** (for LLMs): `/llms.txt`
- **Interactive docs**: `/docs` (Scalar) | `/redoc` (Redocly) | `/swagger` (Swagger)
- **OpenAPI spec**: `/openapi.json`

The OpenAPI spec has the full request and response schemas.

## Self Hosting

Full instructions in [SELF-HOSTING.md](SELF-HOSTING.md).

## License

MIT.
