import { FetchHttpClient, HttpApiClient } from "@effect/platform"
import { Config, Context, Effect, Layer } from "effect"
import * as ApiContract from "./contract"

const make = Effect.andThen(Config.string("RADIANT_API_URL").pipe(Config.withDefault("http://localhost:3000/")), (baseUrl) =>
	HttpApiClient.make(ApiContract.httpApi, { baseUrl }),
)
export class RadiantClient extends Context.Tag("RadiantClient")<
	RadiantClient,
	Effect.Effect.Success<typeof make>
>() {
	static readonly use = <T, E, R>(cb: (rc: typeof RadiantClient.Service) => Effect.Effect<T, E, R>) => Effect.flatMap(RadiantClient, cb)
}
export const layer = Layer.effect(RadiantClient, make)
export const withFetch = layer.pipe(Layer.provide(FetchHttpClient.layer))

export const withHandler = (handler: (req: Request) => Promise<Response>) =>
	layer.pipe(
		Layer.provide(FetchHttpClient.layer),
		Layer.provide(
			Layer.succeed(
				FetchHttpClient.Fetch,
				((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
					handler(
						input instanceof Request
							? new Request(input, init)
							: new Request(input instanceof URL ? input.toString() : input, init),
					)) as typeof fetch,
			),
		),
	)
export * from "./lib"
export { ApiContract }
