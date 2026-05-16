import { Schema } from "effect"

export class FetchRadiosError extends Schema.TaggedError<FetchRadiosError>()(
	"FetchRadiosError",
	{
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not load radios from the database."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export class RadioSelectionNotFoundError extends Schema.TaggedError<RadioSelectionNotFoundError>()(
	"RadioSelectionNotFoundError",
	{
		radioId: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "The selected radio is no longer available."),
		),
	},
) {}
