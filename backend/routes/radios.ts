import { RadioManager } from "../services"
import { HttpApiBuilder, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import { ApiContract } from "@radiant/client"

export const radioGroupLive = HttpApiBuilder.group(ApiContract.httpApi, "radio", (handlers) =>
	handlers.handle(
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
