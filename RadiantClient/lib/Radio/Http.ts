import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
import { RadioId } from "."
import * as Errors from "./errors"
import * as AudioMultiplexerErrors from "../AudioMultiplexerErrors"
import * as AudioSourceErrors from "../AudioSourceErrors"
import * as IcyEncoderErrors from "../IcyEncoderErrors"
import { Authorization } from "../Auth"

const RadioIdParam = HttpApiSchema.param("radioId", RadioId)
const RadioName = Schema.NonEmptyString.pipe(Schema.maxLength(120))
const RadioDescription = Schema.NullOr(Schema.String.pipe(Schema.maxLength(2_000)))
const RadioTimezone = Schema.NonEmptyString.pipe(Schema.maxLength(100))

export const RadioInfo = Schema.Struct({
	id: RadioId,
	name: RadioName,
	description: RadioDescription,
	timezone: RadioTimezone,
	defaultCrossfadeMs: Schema.Number,
	isPublic: Schema.Boolean,
	createdByUserId: Schema.String,
	createdAt: Schema.DateFromString,
	updatedAt: Schema.DateFromString,
})

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
			.middleware(Authorization)
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
