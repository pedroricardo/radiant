import { Schema } from "effect"

export class InsertWeeklyBlockError extends Schema.TaggedError<InsertWeeklyBlockError>()(
	"InsertWeeklyBlockError",
	{
		radioId: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not create the weekly block."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export class InsertOneOffBlockError extends Schema.TaggedError<InsertOneOffBlockError>()(
	"InsertOneOffBlockError",
	{
		radioId: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not create the one-off block."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}
