import { Data } from "effect"
import type { MultiplexerSourceInput } from "./types"

export type Command = Data.TaggedEnum<{
	SetCluster: {
		readonly sources: ReadonlyArray<MultiplexerSourceInput>
		readonly crossfadeMs?: number
	}
	ClearCluster: {}
	SetMasterVolume: {
		readonly volume: number
	}
}>

export const Command = Data.taggedEnum<Command>()
