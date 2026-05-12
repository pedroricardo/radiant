import { RadiantClient } from "@radiant/client"
import { Effect, Option } from "effect"

import { runServerEffect } from "./serverApiClient"

export function getCurrentUser() {
	return RadiantClient.use((client) => client.users.getSelf()).pipe(
		Effect.asSome,
		Effect.catchTag("Unauthorized", () => Effect.succeed(Option.none())),
	)
}
