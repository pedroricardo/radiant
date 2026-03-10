import {
	FetchHttpClient,
	HttpApiBuilder,
	HttpApiSwagger,
	HttpMiddleware,
	HttpServer,
} from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { DateTime, Effect, Layer } from "effect"
import * as RadiantClient from "./RadiantClient"

const usersGroupLive = HttpApiBuilder.group(
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

const RadiantApiLive = HttpApiBuilder.api(RadiantClient.ApiContract.httpApi).pipe(
	Layer.provide(usersGroupLive),
)
const RadiantApiLiveHttpServer = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
	Layer.provide(HttpApiSwagger.layer()),
	Layer.provide(HttpApiBuilder.middlewareCors()),
	Layer.provide(RadiantApiLive),
	HttpServer.withLogAddress,
	Layer.provide(BunHttpServer.layer({ port: 3000 })),
)

// Create a program that derives and uses the client
const programHoled = Effect.gen(function* () {
	yield* Effect.fork(Layer.launch(RadiantApiLiveHttpServer))
	// Derive the client
	const client = yield* RadiantClient.RadiantClient
	// Call the `getUser` endpoint
	const user = yield* client.users.getUser({ path: { id: 1 } })
	console.log(user)
})
const program = programHoled.pipe(
	Effect.provide(Layer.mergeAll(FetchHttpClient.layer, RadiantClient.withFetch)),
)
// Provide a Fetch-based HTTP client and run the program
BunRuntime.runMain(program)
/*
Example Output:
User {
  id: 1,
  name: 'John Doe',
  createdAt: DateTime.Utc(2025-01-04T15:14:49.562Z)
}
*/
