import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

export class AudioSourceConfigurationError extends Schema.TaggedError<AudioSourceConfigurationError>()(
	"AudioSource/ConfigurationError",
	{
		message: Schema.String,
	},
	HttpApiSchema.annotations({ status: 400 }),
) {}
