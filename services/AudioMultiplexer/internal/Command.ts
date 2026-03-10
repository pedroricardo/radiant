import { Data, Duration } from "effect"
import type { MultiplexerSourceInput } from "../types"

export type Command = Data.TaggedEnum<{
	SetCluster: {
		readonly sources: ReadonlyArray<MultiplexerSourceInput>
		readonly crossfadeDuration?: Duration.DurationInput
	}
	ClearCluster: {}
	SetMasterVolume: {
		readonly volume: number
	}
}>

export const Command = Data.taggedEnum<Command>()
