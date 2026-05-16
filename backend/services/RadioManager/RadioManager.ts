import { Radio } from "@radiant/client"
import { Cache, Duration, Effect } from "effect"
import { Drizzle } from "../Drizzle"
import * as IcyEncoder from "../IcyEncoder"
import { RadioManagerConfig } from "./RadioManagerConfig"
import { RadioRepository } from "./RadioRepository"
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
		const db = yield* Drizzle

		const { _tag, ...radioRepo } = yield* RadioRepository

		const getStream = Effect.fn("RadioManager.getStream")(
			function* (radioId: Radio.RadioId) {
				const radio = yield* radioRepo.getRadioInfo(radioId)
				const radioStream = yield* radiosCache.get(radioId)

				return yield* RadioStream.cloneStream(radioStream, {
					kbps: 128,
					title: radio.name,
				})
			},
			Effect.provideService(IcyEncoder.IcyEncoder, encoder),
		)
		return {
			getStream,
			...radioRepo,
		}
	}),
	dependencies: [RadioManagerConfig.Default, IcyEncoder.layer],
}) {}

export const layer = RadioManager.Default
export const layerNoConfig = RadioManager.DefaultWithoutDependencies
export { RadioManagerConfig as Config }
