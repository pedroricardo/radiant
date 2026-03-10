import { Data } from "effect"
import * as AudioSource from "../../lib/AudioSource"

export class MultiplexerInvalidConfigError extends Data.TaggedError(
	"AudioMultiplexer/InvalidConfigError",
)<{
	readonly message: string
}> {}

export class MultiplexerInvalidCrossfadeDurationError extends Data.TaggedError(
	"AudioMultiplexer/InvalidCrossfadeDurationError",
)<{
	readonly crossfadeMs: number
}> {}

export class MultiplexerInvalidMasterVolumeError extends Data.TaggedError(
	"AudioMultiplexer/InvalidMasterVolumeError",
)<{
	readonly volume: number
}> {}

export class MultiplexerInvalidSourceVolumeError extends Data.TaggedError(
	"AudioMultiplexer/InvalidSourceVolumeError",
)<{
	readonly sourceId: string
	readonly volume: number
}> {}

export class MultiplexerSourceChannelMismatchError extends Data.TaggedError(
	"AudioMultiplexer/SourceChannelMismatchError",
)<{
	readonly sourceId: string
	readonly expectedChannels: number
	readonly actualChannels: number
}> {}

export class MultiplexerSourceInvalidSampleRateError extends Data.TaggedError(
	"AudioMultiplexer/SourceInvalidSampleRateError",
)<{
	readonly sourceId: string
	readonly sampleRate: number
}> {}

export class MultiplexerSourceFrameShapeError extends Data.TaggedError(
	"AudioMultiplexer/SourceFrameShapeError",
)<{
	readonly sourceId: string
	readonly frameLength: number
	readonly channels: number
}> {}

export class MultiplexerSourcePullError extends Data.TaggedError(
	"AudioMultiplexer/SourcePullError",
)<{
	readonly sourceId: string
	readonly cause: unknown
}> {}

export class MultiplexerCommandQueueError extends Data.TaggedError(
	"AudioMultiplexer/CommandQueueError",
)<{
	readonly message: string
}> {}

export type MultiplexerError =
	| MultiplexerInvalidConfigError
	| MultiplexerInvalidCrossfadeDurationError
	| MultiplexerInvalidMasterVolumeError
	| MultiplexerInvalidSourceVolumeError
	| MultiplexerSourceChannelMismatchError
	| MultiplexerSourceInvalidSampleRateError
	| MultiplexerSourceFrameShapeError
	| MultiplexerSourcePullError
	| MultiplexerCommandQueueError
	| AudioSource.AudioSourceConfigurationError
