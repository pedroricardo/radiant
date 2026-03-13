import { HttpApiBuilder } from "@effect/platform"
import { DateTime, Effect } from "effect"
import * as RadiantClient from "../RadiantClient"

export const usersGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"users",
	(handlers) =>
		handlers.handle("getUser", ({ path: { id } }) =>
			Effect.succeed({
				id,
				name: "John Doe",
				createdAt: DateTime.unsafeNow(),
			}),
		),
)
