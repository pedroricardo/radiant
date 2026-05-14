import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"
export class RadioManagerDatabaseError extends Schema.TaggedError<RadioManagerDatabaseError>()(
	"RadioManagerDatabaseError",
	{
		message: Schema.String,
		cause: Schema.Unknown.pipe(Schema.optional),
	},
	HttpApiSchema.annotations({ status: 500 }),
) {}

export class RadioNotFound extends Schema.TaggedError<RadioNotFound>()(
	"RadioNotFound",
	{
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Unknown Radio ID"),
		),
	},
	HttpApiSchema.annotations({ status: 500 }),
) {}
