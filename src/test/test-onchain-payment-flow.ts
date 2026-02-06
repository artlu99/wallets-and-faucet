import dotenv from "@dotenvx/dotenvx";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

// these are the values to test
const BASE_URL = "https://wallets-and-faucet.uk"; // "http://localhost:8787"
const publicAddress = "0x...";
const encryptionSecret = "xyz789...";
const salt = "abcd1234...";

dotenv.config();

// N.B. this address should have at least $0.10 of Base USDC
const PK = dotenv.get("EVM_PRIVATE_KEY");
if (!PK) throw new Error("EVM_PRIVATE_KEY is required (e.g. in .env)");

// reference: https://docs.x402.org/getting-started/quickstart-for-buyers
const signer = privateKeyToAccount(`0x${PK.replace("0x", "")}`);
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment(`${BASE_URL}/eoa/${publicAddress}`, {
	method: "GET",
	headers: {
		"x-encryption-secret": encryptionSecret,
		"x-salt": salt,
	},
});

const data = await response.json();
console.log(data);

// Get payment receipt from response headers
try {
	const httpClient = new x402HTTPClient(client);
	const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
		response.headers.get(name),
	);
	console.log(paymentResponse);
} catch (_err) {
	console.log("No receipt seen, full response:", response);
}
