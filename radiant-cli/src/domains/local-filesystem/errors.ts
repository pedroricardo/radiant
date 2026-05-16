import { Schema } from "effect"

export class ReadLocalDirectoryError extends Schema.TaggedError<ReadLocalDirectoryError>()(
	"ReadLocalDirectoryError",
	{
		path: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not read the selected local directory."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export class ReadLocalFileInfoError extends Schema.TaggedError<ReadLocalFileInfoError>()(
	"ReadLocalFileInfoError",
	{
		path: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not inspect the selected local file."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export class InvalidLocalAudioFileError extends Schema.TaggedError<InvalidLocalAudioFileError>()(
	"InvalidLocalAudioFileError",
	{
		path: Schema.String,
		message: Schema.String,
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}
