import { HttpApiBuilder } from "@effect/platform"
import * as RadiantClient from "@radiant/client"
import { CurrentUser } from "@radiant/client/contract"
import { Effect, Option } from "effect"
import { UserRepository } from "../services/UserRepository"

export const usersGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"users",
	(handlers) =>
		handlers
			.handle("getUser", ({ path: { id } }) => Effect.dieMessage("TODO: get user " + id))
			.handle(
				"getSelf",
				Effect.fn("http.users.getSelf")(function* (req) {
					const userRepo = yield* UserRepository
					return Option.getOrThrow(yield* userRepo.getUser(yield* CurrentUser))
				}),
			)
			.handle(
				"getSelfStorage",
				Effect.fn("http.users.getSelfStorage")(function* () {
					const userRepo = yield* UserRepository
					return yield* userRepo.getStorageInfo(yield* CurrentUser)
				}, Effect.orDie),
			),
)
