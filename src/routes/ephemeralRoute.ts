import { encode as b85encode } from "@alttiri/base85";
import { OpenAPIRoute } from "chanfana";
import invariant from "tiny-invariant";
import { z } from "zod";
import { randomBytes } from "../lib/random";
import { EncryptionKeySchema, UserSaltSchema } from "../lib/types";

export class EphemeralSecretsRoute extends OpenAPIRoute {
	schema = {
		summary: "Create ephemeral secrets",
		description:
			"Generates a salt and encryption secret as a matched pair. Store them together as a single unit (e.g. one password-manager entry) — they are only useful together, and losing either half makes a wallet created with them permanently unrecoverable",
		responses: {
			"200": {
				description: "Generates an ephemeral salt and encryption key",
				content: {
					"application/json": {
						schema: z.object({
							salt: z.string().meta({
								description:
									"Ephemeral salt (satisfies the ≥16-character user-salt floor)",
								example: "wQ7z9BcK2mNf8vXs4LpR",
							}),
							encryption_secret: z.string().meta({
								description: "Ephemeral encryption key",
								example: "xyz789...",
							}),
							independent: z.boolean().meta({
								description:
									"Whether the salt and encryption key are independent",
								example: true,
							}),
							mixed: z.boolean().meta({
								description:
									"Whether the entropy was mixed with a public source",
								example: false,
							}),
							storage_advice: z.string().meta({
								description: "How to store these secrets",
								example:
									"Store salt and encryption_secret together as one unit; they only work as a pair",
							}),
						}),
					},
				},
			},
		},
	};

	async handle() {
		const salt = b85encode(randomBytes(16));
		const encryptionKey = b85encode(randomBytes(256 / 8));

		invariant(UserSaltSchema.safeParse(salt).success, "Invalid salt generated");
		invariant(
			EncryptionKeySchema.safeParse(encryptionKey).success,
			"Invalid encryption key generated",
		);

		return {
			salt: salt,
			encryption_secret: encryptionKey,
			independent: true,
			mixed: false,
			storage_advice:
				"Store salt and encryption_secret together as one unit; they only work as a pair",
		};
	}
}
