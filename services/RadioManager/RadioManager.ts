import type { Radio } from "$lib"
import { IcyEncoder } from "$services"
import { Cache, Duration, Effect } from "effect"
import { RadioManagerConfig } from "./RadioManagerConfig"
import * as RadioStream from "./RadioStream"

export class RadioManager extends Effect.Service<RadioManager>()("RadioManager", {
	accessors: true,
	scoped: Effect.gen(function* () {
		const radiosCache = yield* Cache.make({
			capacity: Infinity,
			lookup: RadioStream.startRadio,
			timeToLive: Duration.infinity,
		})
		const encoder = yield* IcyEncoder.IcyEncoder

		const getStream = Effect.fn(
			function* (radioId: Radio.RadioId) {
				const radioStream = yield* radiosCache.get(radioId)
				return yield* RadioStream.cloneStream(radioStream, {
					kbps: 128,
					title: "Radiant Stream",
				})
			},
			Effect.provideService(IcyEncoder.IcyEncoder, encoder),
		)
		// TODOs
		return {
			getStream,
		}
	}),
	dependencies: [RadioManagerConfig.Default],
}) {}

export const layer = RadioManager.Default
export const layerNoConfig = RadioManager.DefaultWithoutDependencies
export { RadioManagerConfig as Config }
