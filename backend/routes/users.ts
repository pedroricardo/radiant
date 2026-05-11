import { UserRepository } from "../services/UserRepository"
import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import * as RadiantClient from "@radiant/client"
import { CurrentUser } from "@radiant/client/contract"

export const usersGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"users",
	(handlers) =>
		handlers
			.handle("getUser", ({ path: { id } }) => Effect.dieMessage("TODO: get user " + id))
			.handle(
				"getSelf",
				Effect.fn("http.users.getSelf")(
					function* (req) {
						const userRepo = yield* UserRepository
						return yield* yield* userRepo.getUser(yield* CurrentUser)
					},
					Effect.orDie, // We shouldn't get a NoSuchElementException because the user will exist if we even get into the route main code, and if we get a database error, well, we can't really do anything except explode and return a 500 error
				),
			),
)
