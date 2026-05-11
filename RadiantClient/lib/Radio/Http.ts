import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { RadioId } from "."
import * as AudioMultiplexerErrors from "../AudioMultiplexerErrors"
import * as AudioSourceErrors from "../AudioSourceErrors"
import * as IcyEncoderErrors from "../IcyEncoderErrors"

const RadioIdParam = HttpApiSchema.param("radioId", RadioId)

export const radioGroup = HttpApiGroup.make("radio")
	.add(
		HttpApiEndpoint.get("listen")`/${RadioIdParam}/listen`
			.addSuccess(
				Schema.Uint8ArrayFromSelf.pipe(
					HttpApiSchema.withEncoding({
						kind: "Uint8Array",
						contentType: "audio/mpeg",
					}),
				),
			)
			.addError(AudioMultiplexerErrors.MultiplexerInvalidConfigError)
			.addError(AudioMultiplexerErrors.MultiplexerInvalidCrossfadeDurationError)
			.addError(AudioMultiplexerErrors.MultiplexerInvalidMasterVolumeError)
			.addError(AudioMultiplexerErrors.MultiplexerInvalidSourceVolumeError)
			.addError(AudioMultiplexerErrors.MultiplexerSourceChannelMismatchError)
			.addError(AudioMultiplexerErrors.MultiplexerSourceInvalidSampleRateError)
			.addError(AudioMultiplexerErrors.MultiplexerSourceFrameShapeError)
			.addError(AudioMultiplexerErrors.MultiplexerSourcePullError)
			.addError(AudioMultiplexerErrors.MultiplexerCommandQueueError)
			.addError(AudioSourceErrors.AudioSourceConfigurationError)
			.addError(IcyEncoderErrors.EncodingError),
	)
	.prefix("/radios")
