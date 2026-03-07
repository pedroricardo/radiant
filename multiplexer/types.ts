import { AudioSource } from "../audio-source"
import { Chunk, Effect, Option } from "effect"

export interface MultiplexerSourceInput {
	readonly id: string
	readonly source: AudioSource.AudioSource<number, any, never>
	readonly volume?: number
}

export interface AudioMultiplexerConfig {
	readonly sampleRate: number
	readonly channels: 1 | 2
	readonly frameSamples: number
	readonly defaultCrossfadeMs: number
}

export type RuntimeSource = {
	readonly id: string
	readonly volume: number
	readonly pull: Effect.Effect<Chunk.Chunk<Float32Array>, Option.Option<unknown>>
	readonly buffer: Float32Array
	readonly ended: boolean
}

export type RuntimeCluster = {
	readonly id: number
	readonly sources: ReadonlyArray<RuntimeSource>
}

export type MultiplexerState = {
	readonly nextClusterId: number
	readonly activeCluster: RuntimeCluster | null
	readonly fadingOutCluster: RuntimeCluster | null
	readonly fadeProgressSamples: number
	readonly fadeTotalSamples: number
	readonly masterVolume: number
}
