import { Drizzle, IcyEncoder, PlayoutManager, RadioManager } from "$services"
import { Layer, pipe } from "effect"

export const Live = Layer.suspend(() =>
	pipe(
		RadioManager.layer,
		Layer.provideMerge(IcyEncoder.layer),
		Layer.provideMerge(Drizzle.layer),
		Layer.provide(PlayoutManager.layer),
	),
)
