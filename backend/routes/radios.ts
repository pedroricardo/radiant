import { HttpApiBuilder, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { ApiContract } from "@radiant/client"
import { CurrentUser } from "@radiant/client/contract"
import { Effect, Option, Stream } from "effect"
import { RadioManager } from "../services"

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
			Effect.fn("radio.listen")(function* ({ path: { radioId }, request }) {
				const radioManager = yield* RadioManager.RadioManager
				const httpRequest = yield* HttpServerRequest.HttpServerRequest
				const userAgent = httpRequest.headers["user-agent"] ?? null
				const remoteAddress = Option.getOrNull(httpRequest.remoteAddress)
				yield* Effect.logInfo("radio.listen.connected").pipe(
					Effect.annotateLogs({
						radioId,
						method: request.method,
						url: request.url,
						userAgent,
						remoteAddress,
					}),
				)
				const icyStream = yield* radioManager
					.getStream(radioId)
					.pipe(Effect.catchAll((e) => (e._tag == "RadioNotFound" ? e : Effect.die(e))))

				const instrumentedStream = icyStream.stream.pipe(
					Stream.ensuring(
						Effect.logInfo("radio.listen.disconnected").pipe(
							Effect.annotateLogs({
								radioId,
								userAgent,
								remoteAddress,
							}),
						),
					),
				)

				return HttpServerResponse.stream(instrumentedStream).pipe(
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
