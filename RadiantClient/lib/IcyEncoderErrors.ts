import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

export class EncodingError extends Schema.TaggedError<EncodingError>()(
	"IcyEncoder/EncodingError",
	{
		message: Schema.String,
		cause: Schema.Unknown,
	},
	HttpApiSchema.annotations({ status: 500 }),
) {}
