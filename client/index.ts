import { FetchHttpClient, HttpApiClient } from "@effect/platform"
import { Config, Context, Effect, Layer } from "effect"
import { radiantApi } from "../contract"

export namespace RadiantClient {
	const make = Effect.andThen(Config.string("RADIANT_API_URL"), (baseUrl) =>
		HttpApiClient.make(radiantApi, { baseUrl }),
	)
	export class RadiantClient extends Context.Tag("RadiantClient")<
		RadiantClient,
		Effect.Effect.Success<typeof make>
	>() {}
	export const layer = Layer.effect(RadiantClient, make)
	export const withFetch = layer.pipe(Layer.provide(FetchHttpClient.layer))
}
