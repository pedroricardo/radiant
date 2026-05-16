import { Schema } from "effect"

export class FetchAudioNodesError extends Schema.TaggedError<FetchAudioNodesError>()(
	"FetchAudioNodesError",
	{
		radioId: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not load audio files for the selected radio."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export class NoAudioNodesForRadioError extends Schema.TaggedError<NoAudioNodesForRadioError>()(
	"NoAudioNodesForRadioError",
	{
		radioId: Schema.String,
		radioName: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "This radio does not have any audio files yet."),
		),
	},
) {
	static forRadio(input: { radioId: string; radioName: string }) {
		return new NoAudioNodesForRadioError({
			...input,
			message: `Radio "${input.radioName}" does not have any audio files yet.`,
		})
	}
}
