import { type Account, bytesToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "./random";

export function getRandomPrivateKey(): Hex {
	return bytesToHex(randomBytes(32));
}

export function getAccount(privateKey: Hex): Account {
	return privateKeyToAccount(privateKey);
}
