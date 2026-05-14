import { Layer, pipe } from "effect"
import { Drizzle, IcyEncoder, PlayoutManager, RadioManager } from "../services"

export const Live = Layer.suspend(() =>
	pipe(
		RadioManager.layer,
		Layer.provideMerge(IcyEncoder.layer),
		Layer.provideMerge(Drizzle.layer),
		Layer.provide(PlayoutManager.layer),
	),
)
