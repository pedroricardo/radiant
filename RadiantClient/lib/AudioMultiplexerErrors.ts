import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import type { AudioSourceConfigurationError } from "./AudioSourceErrors"

// Auxiliar para não repetir o status em erros de validação simples
const BadRequest = <T>() => HttpApiSchema.annotations<T>({ status: 400 })
const InternalServerError = <T>() => HttpApiSchema.annotations<T>({ status: 500 })

export class MultiplexerInvalidConfigError extends Schema.TaggedError<MultiplexerInvalidConfigError>()(
	"AudioMultiplexer/InvalidConfigError",
	{ message: Schema.String },
	BadRequest(),
) {}

export class MultiplexerInvalidCrossfadeDurationError extends Schema.TaggedError<MultiplexerInvalidCrossfadeDurationError>()(
	"AudioMultiplexer/InvalidCrossfadeDurationError",
	{ crossfadeMs: Schema.Number },
	BadRequest(),
) {}

export class MultiplexerInvalidMasterVolumeError extends Schema.TaggedError<MultiplexerInvalidMasterVolumeError>()(
	"AudioMultiplexer/InvalidMasterVolumeError",
	{ volume: Schema.Number },
	BadRequest(),
) {}

export class MultiplexerInvalidSourceVolumeError extends Schema.TaggedError<MultiplexerInvalidSourceVolumeError>()(
	"AudioMultiplexer/InvalidSourceVolumeError",
	{ sourceId: Schema.String, volume: Schema.Number },
	BadRequest(),
) {}

export class MultiplexerSourceChannelMismatchError extends Schema.TaggedError<MultiplexerSourceChannelMismatchError>()(
	"AudioMultiplexer/SourceChannelMismatchError",
	{
		sourceId: Schema.String,
		expectedChannels: Schema.Number,
		actualChannels: Schema.Number,
	},
	BadRequest(),
) {}

export class MultiplexerSourceInvalidSampleRateError extends Schema.TaggedError<MultiplexerSourceInvalidSampleRateError>()(
	"AudioMultiplexer/SourceInvalidSampleRateError",
	{ sourceId: Schema.String, sampleRate: Schema.Number },
	BadRequest(),
) {}

export class MultiplexerSourceFrameShapeError extends Schema.TaggedError<MultiplexerSourceFrameShapeError>()(
	"AudioMultiplexer/SourceFrameShapeError",
	{ sourceId: Schema.String, frameLength: Schema.Number, channels: Schema.Number },
	BadRequest(),
) {}

export class MultiplexerSourcePullError extends Schema.TaggedError<MultiplexerSourcePullError>()(
	"AudioMultiplexer/SourcePullError",
	{
		sourceId: Schema.String,
		cause: Schema.Unknown,
	},
	InternalServerError(),
) {}

export class MultiplexerCommandQueueError extends Schema.TaggedError<MultiplexerCommandQueueError>()(
	"AudioMultiplexer/CommandQueueError",
	{ message: Schema.String },
	InternalServerError(),
) {}

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
	| AudioSourceConfigurationError
