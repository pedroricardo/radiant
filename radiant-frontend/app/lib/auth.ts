import { RadiantClient } from "@radiant/client"
import { Effect } from "effect"


export function getCurrentUser() {
	return RadiantClient.use((client) => client.users.getSelf()).pipe(
		Effect.asSome,
		Effect.catchTag("Unauthorized", () => Effect.succeedNone)
	)
}
