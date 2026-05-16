import { Schema } from "effect"

export class FetchPlaylistsError extends Schema.TaggedError<FetchPlaylistsError>()(
	"FetchPlaylistsError",
	{
		radioId: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Could not load playlists for the selected radio."),
		),
		cause: Schema.Unknown.pipe(Schema.optional),
	},
) {}

export class NoPlaylistsForRadioError extends Schema.TaggedError<NoPlaylistsForRadioError>()(
	"NoPlaylistsForRadioError",
	{
		radioId: Schema.String,
		radioName: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "This radio does not have any playlists yet."),
		),
	},
) {
	static forRadio(input: { radioId: string; radioName: string }) {
		return new NoPlaylistsForRadioError({
			...input,
			message: `Radio "${input.radioName}" does not have any playlists yet.`,
		})
	}
}
