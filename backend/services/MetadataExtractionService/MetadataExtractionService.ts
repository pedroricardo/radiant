import { Context, Data, Effect, Layer, Stream } from "effect"
import { parseStream } from "music-metadata"
import { Readable } from "node:stream"

export interface ExtractedAudioMetadata {
	readonly durationMs: number
	readonly containerFormat: string | null
	readonly audioCodec: string | null
	readonly bitrate: number | null
	readonly title: string | null
	readonly artist: string | null
	readonly album: string | null
	readonly albumArtist: string | null
	readonly genre: string | null
	readonly year: number | null
	readonly trackNumber: number | null
	readonly trackTotal: number | null
	readonly diskNumber: number | null
	readonly diskTotal: number | null
	readonly coverArt:
		| {
				readonly data: Uint8Array
				readonly mimeType: string | null
		  }
		| null
	readonly sampleRate: number | null
	readonly channels: number | null
	readonly mimeType: string | null
}

export class MetadataExtractionError extends Data.TaggedError("MetadataExtractionError")<{
	message: string
	cause: unknown
}> {}

export class InvalidAudioFileError extends Data.TaggedError("InvalidAudioFileError")<{
	message: string
}> {}

export class MetadataExtractionService extends Context.Tag("MetadataExtractionService")<
	MetadataExtractionService,
	{
		readonly extractAudioMetadata: (args: {
			readonly name: string
			readonly contentType?: string | undefined
			readonly content: Stream.Stream<Uint8Array, unknown>
		}) => Effect.Effect<ExtractedAudioMetadata, MetadataExtractionError | InvalidAudioFileError>
	}
>() {}

export const UnimplementedMetadataExtractionService: Layer.Layer<MetadataExtractionService> = Layer.succeed(
	MetadataExtractionService,
	{
		extractAudioMetadata: (_args) =>
			Effect.dieMessage("MetadataExtractionService.extractAudioMetadata not implemented"),
	},
)

export const MusicMetadataExtractionService = Layer.succeed(
	MetadataExtractionService,
	{
		extractAudioMetadata: ({ name, content, contentType }) =>
			Effect.gen(function* () {
				const readableStream = yield* Stream.toReadableStreamEffect(content)
				const nodeStream = Readable.fromWeb(
					readableStream as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
				)

				const metadata = yield* Effect.tryPromise({
					try: () =>
						parseStream(
							nodeStream,
							{ mimeType: contentType, path: name },
							{ duration: true, skipCovers: false },
						),
					catch: (cause) =>
						new MetadataExtractionError({
							message: "failed to extract audio metadata",
							cause,
						}),
				})

				const durationSeconds = metadata.format.duration
				if (
					durationSeconds == null ||
					!Number.isFinite(durationSeconds) ||
					durationSeconds <= 0
				) {
					return yield* new InvalidAudioFileError({
						message: "audio file metadata is missing a valid duration",
					})
				}

				return {
					durationMs: Math.round(durationSeconds * 1000),
					containerFormat: metadata.format.container ?? null,
					audioCodec: metadata.format.codec ?? null,
					bitrate:
						typeof metadata.format.bitrate === "number" && Number.isFinite(metadata.format.bitrate)
							? Math.round(metadata.format.bitrate)
							: null,
					title: metadata.common.title ?? null,
					artist: metadata.common.artist ?? null,
					album: metadata.common.album ?? null,
					albumArtist: metadata.common.albumartist ?? null,
					genre: Array.isArray(metadata.common.genre)
						? metadata.common.genre.filter((value) => value.trim().length > 0).join(", ") || null
						: null,
					year: typeof metadata.common.year === "number" ? metadata.common.year : null,
					trackNumber:
						typeof metadata.common.track.no === "number" ? metadata.common.track.no : null,
					trackTotal:
						typeof metadata.common.track.of === "number" ? metadata.common.track.of : null,
					diskNumber:
						typeof metadata.common.disk.no === "number" ? metadata.common.disk.no : null,
					diskTotal:
						typeof metadata.common.disk.of === "number" ? metadata.common.disk.of : null,
					coverArt:
						metadata.common.picture != null && metadata.common.picture.length > 0
							? {
									data: metadata.common.picture[0]!.data,
									mimeType: metadata.common.picture[0]!.format ?? null,
								}
							: null,
					sampleRate:
						typeof metadata.format.sampleRate === "number" ? metadata.format.sampleRate : null,
					channels:
						typeof metadata.format.numberOfChannels === "number"
							? metadata.format.numberOfChannels
							: null,
					mimeType: contentType ?? null,
				} satisfies ExtractedAudioMetadata
			}),
	},
)
