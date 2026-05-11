import { FetchHttpClient, HttpApiClient } from "@effect/platform"
import { Config, Context, Effect, Layer } from "effect"
import * as ApiContract from "./contract"

const make = Effect.andThen(Config.string("RADIANT_API_URL"), (baseUrl) =>
	HttpApiClient.make(ApiContract.httpApi, { baseUrl }),
)
export class RadiantClient extends Context.Tag("RadiantClient")<
	RadiantClient,
	Effect.Effect.Success<typeof make>
>() {}
export const layer = Layer.effect(RadiantClient, make)
export const withFetch = layer.pipe(Layer.provide(FetchHttpClient.layer))
export * from "./lib"
export { ApiContract }
