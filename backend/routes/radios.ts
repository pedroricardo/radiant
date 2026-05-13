import { RadioManager } from "../services"
import { HttpApiBuilder, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import { ApiContract } from "@radiant/client"
import { CurrentUser } from "@radiant/client/contract"

export const radioGroupLive = HttpApiBuilder.group(ApiContract.httpApi, "radio", (handlers) =>
	handlers
		.handle(
			"list",
			Effect.fn("radio.list")(function* () {
				const radioManager = yield* RadioManager.RadioManager
				const userId = yield* CurrentUser
				return yield* radioManager.listUserRadios(userId)
			}),
		)
		.handle(
			"create",
			Effect.fn("radio.create")(function* ({ payload }) {
				const radioManager = yield* RadioManager.RadioManager
				const userId = yield* CurrentUser

				return yield* radioManager.createRadio({
					...payload,
					createdByUserId: userId,
				})
			}),
		)
		.handle(
			"get",
			Effect.fn("radio.get")(function* ({ path: { radioId } }) {
				const radioManager = yield* RadioManager.RadioManager
				const userId = yield* CurrentUser
				return yield* radioManager.getUserRadioInfo(userId, radioId)
			}),
		)
		.handle(
			"update",
			Effect.fn("radio.update")(function* ({ path: { radioId }, payload }) {
				const radioManager = yield* RadioManager.RadioManager
				const userId = yield* CurrentUser
				return yield* radioManager.updateUserRadio(userId, radioId, payload)
			}),
		)
		.handle(
			"delete",
			Effect.fn("radio.delete")(function* ({ path: { radioId } }) {
				const radioManager = yield* RadioManager.RadioManager
				const userId = yield* CurrentUser
				yield* radioManager.deleteUserRadio(userId, radioId)
			}),
		)
		.handle(
			"listen",
			Effect.fn("radio.listen")(function* ({ path: { radioId } }) {
				const radioManager = yield* RadioManager.RadioManager
				const icyStream = yield* radioManager.getStream(radioId)

				return HttpServerResponse.stream(icyStream.stream).pipe(
					HttpServerResponse.setHeaders({
						"Icy-Name": icyStream.metadataTitle,
						"Icy-Metaint": icyStream.metaInterval.toString(),
						"Cache-Control": "no-cache, no-store",
						Connection: "keep-alive",
					}),
				)
			}),
		),
)
