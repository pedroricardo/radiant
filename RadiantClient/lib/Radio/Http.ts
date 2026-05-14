import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { RadioDescription, RadioId, RadioInfo, RadioName, RadioTimezone } from "."
import * as AudioMultiplexerErrors from "../AudioMultiplexerErrors"
import * as AudioSourceErrors from "../AudioSourceErrors"
import { Authorization } from "../Auth"
import * as IcyEncoderErrors from "../IcyEncoderErrors"
import * as Errors from "./errors"

const RadioIdParam = HttpApiSchema.param("radioId", RadioId)

export const CreateRadioRequest = Schema.Struct({
	name: RadioName,
	description: Schema.optional(RadioDescription),
	timezone: RadioTimezone,
	defaultCrossfadeMs: Schema.optional(Schema.Number),
	isPublic: Schema.optional(Schema.Boolean),
})

export const UpdateRadioRequest = Schema.partial(
	Schema.Struct({
		name: RadioName,
		description: RadioDescription,
		timezone: RadioTimezone,
		defaultCrossfadeMs: Schema.Number,
		isPublic: Schema.Boolean,
	}),
)

export const radioGroup = HttpApiGroup.make("radio")
	.add(
		HttpApiEndpoint.get("list")`/`
			.addSuccess(Schema.Array(RadioInfo))
			.addError(Errors.RadioManagerDatabaseError)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("create")`/`
			.setPayload(CreateRadioRequest)
			.addSuccess(RadioInfo)
			.middleware(Authorization)
			.addError(Errors.RadioManagerDatabaseError),
	)
	.add(
		HttpApiEndpoint.get("get")`/${RadioIdParam}`
			.addSuccess(RadioInfo)
			.middleware(Authorization)
			.addError(Errors.RadioNotFound)
			.addError(Errors.RadioManagerDatabaseError),
	)
	.add(
		HttpApiEndpoint.patch("update")`/${RadioIdParam}`
			.middleware(Authorization)
			.setPayload(UpdateRadioRequest)
			.addSuccess(RadioInfo)
			.addError(Errors.RadioNotFound)
			.addError(Errors.RadioManagerDatabaseError),
	)
	.add(
		HttpApiEndpoint.del("delete")`/${RadioIdParam}`
			.middleware(Authorization)
			.addSuccess(Schema.Void)
			.addError(Errors.RadioNotFound)
			.addError(Errors.RadioManagerDatabaseError),
	)
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
			.addError(Errors.RadioNotFound)
			.addError(Errors.RadioManagerDatabaseError)
			.addError(IcyEncoderErrors.EncodingError),
	)
	.prefix("/radios")
