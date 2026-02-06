import { Num, OpenAPIRoute, Str } from "chanfana";

import { z } from "zod";
import { humanReadableChargePerRequest, humanReadableTtl } from "../lib/config";
import { BEACON } from "../lib/random";
import type { AppContext } from "../lib/types";

export class StatusRoute extends OpenAPIRoute {
	schema = {
		summary: "Show statistics about the API",
		responses: {
			"200": {
				description: "Returns statistics about the API",
				content: {
					"application/json": {
						schema: z.object({
							total_eoa_created: Num({
								description: "Total number of EOAs created",
							}),
							total_eoa_retrieved: Num({
								description: "Total number of successful requests",
							}),
							total_eoa_failed_to_decrypt: Num({
								description: "Total number of failed requests",
							}),
							current_eoa_count: Num({
								description: "Current number of EOAs in the database",
							}),
							time_to_deletion: Str({
								description: "Storage time before deletion (human-readable)",
							}),
							x402_price: Str({
								description: "Price per request (human-readable)",
							}),
							public_randomness_source: Str({
								description: "Public randomness source",
							}),
							user_provided_salt_rules: Str({
								description: "Rules for user provided salt",
							}),
							user_provided_encryption_key_rules: Str({
								description: "Rules for user provided encryption key",
							}),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const total_eoa_created = await c.env.WALLET_SECRETS.get("created_counter");
		const total_eoa_retrieved =
			await c.env.WALLET_SECRETS.get("retrieved_counter");
		const total_eoa_failed_to_decrypt = await c.env.WALLET_SECRETS.get(
			"failed_to_decrypt_counter",
		);
		const listKeysUpTo1000 = await c.env.WALLET_SECRETS.list();
		const timeToDeletion = Number(c.env.TTL);

		return {
			total_eoa_created: Math.max(
				Number(total_eoa_created || 0),
				listKeysUpTo1000.keys?.length || 0,
			),
			total_eoa_retrieved: total_eoa_retrieved || 0,
			total_eoa_failed_to_decrypt: total_eoa_failed_to_decrypt || 0,
			current_eoa_count: Math.max(listKeysUpTo1000.keys?.length || 0 - 3, 0),
			time_to_deletion: humanReadableTtl(timeToDeletion),
			x402_price: humanReadableChargePerRequest(
				Number(c.env.CHARGE_PER_REQUEST),
			),
			public_randomness_source: BEACON,
			user_provided_salt_rules: "≤255 character Base85 string",
			user_provided_encryption_key_rules:
				"40-character Base85 string (256-bit key)",
		};
	}
}
