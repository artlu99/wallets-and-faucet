import { encode as b85encode } from "@alttiri/base85";
import { Bool, OpenAPIRoute, Str } from "chanfana";
import invariant from "tiny-invariant";
import { z } from "zod";
import { randomBytes } from "../lib/random";
import { EncryptionKeySchema, SaltSchema } from "../lib/types";

export class EphemeralSecretsRoute extends OpenAPIRoute {
	schema = {
		summary: "Create ephemeral secrets",
		responses: {
			"200": {
				description: "Generates an ephemeral salt and encryption key",
				content: {
					"application/json": {
						schema: z.object({
							salt: Str({
								description: "Ephemeral salt",
								example: "1234567890abcd",
							}),
							encryption_secret: Str({
								description: "Ephemeral encryption key",
								example: "1234567890123456789012345678901234567890",
							}),
							independent: Bool({
								description: "Whether the salt and encryption key are independent",
								example: true,
							}),
							mixed: Bool({
								description: "Whether the entropy was mixed with a public source",
								example: false,
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

		invariant(SaltSchema.safeParse(salt).success, "Invalid salt generated");
		invariant(
			EncryptionKeySchema.safeParse(encryptionKey).success,
			"Invalid encryption key generated",
		);

		return {
			salt: salt,
			encryption_secret: encryptionKey,
			independent: true,
			mixed: false
		};
	}
}
