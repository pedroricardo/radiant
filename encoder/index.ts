import * as lamejs from "@breezystack/lamejs"
import { Data, Effect, Stream } from "effect"
import { AudioSource } from "../audio-source"

function concatUint8Arrays(chunks: ReadonlyArray<Uint8Array>): Uint8Array {
	let totalLength = 0
	for (const chunk of chunks) {
		totalLength += chunk.length
	}

	const result = new Uint8Array(totalLength)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.length
	}
	return result
}

function createICYMetadata(title: string): Uint8Array {
	const encoder = new TextEncoder()

	const metadataString = `StreamTitle='${title}';`
	const metadataBytes = encoder.encode(metadataString)

	const blocks = Math.ceil(metadataBytes.length / 16)
	const paddedLength = blocks * 16

	const padded = new Uint8Array(paddedLength)
	padded.set(metadataBytes)

	const result = new Uint8Array(1 + paddedLength)

	result[0] = blocks
	result.set(padded, 1)

	return result
}
export class EncodingError extends Data.TaggedError("IcyEncoder/EncodingError")<{
	message: string
	cause: unknown
}> {}

const DEFAULT_META_INTERVAL = 16_000
const DEFAULT_METADATA_TITLE = "Radiant FM"

const clampToInt16 = (value: number): number => {
	const val = Math.max(-1, Math.min(1, value))
	return val < 0 ? val * 0x8000 : val * 0x7fff
}

const encodeFrame = (
	mp3Encoder: lamejs.Mp3Encoder,
	frame: Float32Array,
	channels: 1 | 2,
): Effect.Effect<Uint8Array, EncodingError> =>
	Effect.gen(function* () {
		if (frame.length === 0) {
			return new Uint8Array(0)
		}

		if (frame.length % channels !== 0) {
			return yield* Effect.fail(
				new EncodingError({
					message: `pcm frame length ${frame.length} is not divisible by channels ${channels}`,
					cause: { frameLength: frame.length, channels },
				}),
			)
		}

		const samplesPerChannel = frame.length / channels

		if (channels === 1) {
			const mono = new Int16Array(samplesPerChannel)
			for (let i = 0; i < samplesPerChannel; i++) {
				mono[i] = clampToInt16(frame[i] ?? 0)
			}

			return yield* Effect.try({
				try: () => new Uint8Array(mp3Encoder.encodeBuffer(mono)),
				catch: (e) => new EncodingError({ message: "failed to encode mono buffer", cause: e }),
			})
		}

		const left = new Int16Array(samplesPerChannel)
		const right = new Int16Array(samplesPerChannel)
		for (let i = 0; i < samplesPerChannel; i++) {
			const base = i * 2
			left[i] = clampToInt16(frame[base] ?? 0)
			right[i] = clampToInt16(frame[base + 1] ?? 0)
		}

		return yield* Effect.try({
			try: () => new Uint8Array(mp3Encoder.encodeBuffer(left, right)),
			catch: (e) => new EncodingError({ message: "failed to encode stereo buffer", cause: e }),
		})
	})

const injectMetadata = (mp3Chunk: Uint8Array, state: { bytesSinceLastMeta: number }, metadata: Uint8Array, metaInterval: number): Uint8Array => {
	if (metaInterval <= 0 || mp3Chunk.length === 0) {
		return mp3Chunk
	}

	const parts: Uint8Array[] = []
	let offset = 0

	while (offset < mp3Chunk.length) {
		const remainingUntilMeta = metaInterval - state.bytesSinceLastMeta
		const nextSliceLength = Math.min(remainingUntilMeta, mp3Chunk.length - offset)
		const nextOffset = offset + nextSliceLength

		parts.push(mp3Chunk.subarray(offset, nextOffset))
		state.bytesSinceLastMeta += nextSliceLength
		offset = nextOffset

		if (state.bytesSinceLastMeta === metaInterval) {
			parts.push(metadata)
			state.bytesSinceLastMeta = 0
		}
	}

	return parts.length === 1 ? parts[0]! : concatUint8Arrays(parts)
}

export class IcyEncoder extends Effect.Service<IcyEncoder>()("IcyEncoder", {
	accessors: true,
		effect: Effect.gen(function* () {
			const encode = Effect.fn("IcyEncoder.encode")(function* (
				source: AudioSource.AudioSource<number, any, any>,
				options: {
					kbps: number
					metaInterval?: number
					metadataTitle?: string
				},
			) {
				const channels = source.channels
				const sampleRate = source.sampleRate
				const metaInterval = options.metaInterval ?? DEFAULT_META_INTERVAL
				const metadataTitle = options.metadataTitle ?? DEFAULT_METADATA_TITLE
				if (!Number.isInteger(channels) || (channels !== 1 && channels !== 2)) {
					return yield* Effect.fail(
					new EncodingError({
						message: `unsupported channels: ${channels}`,
						cause: { channels },
						}),
					)
				}
				if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
					return yield* Effect.fail(
						new EncodingError({
							message: `invalid sampleRate: ${sampleRate}`,
							cause: { sampleRate },
						}),
					)
				}
			if (!Number.isFinite(options.kbps) || options.kbps <= 0) {
				return yield* Effect.fail(
					new EncodingError({
						message: `invalid kbps: ${options.kbps}`,
						cause: { kbps: options.kbps },
					}),
				)
			}
			if (!Number.isInteger(metaInterval) || metaInterval <= 0) {
				return yield* Effect.fail(
					new EncodingError({
						message: `invalid metaInterval: ${metaInterval}`,
						cause: { metaInterval },
					}),
				)
			}

				const state = { bytesSinceLastMeta: 0 }
				const metadataChunk = createICYMetadata(metadataTitle)
				const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, options.kbps)

				return source.stream.pipe(
					Stream.mapEffect((frame) =>
						Effect.map(encodeFrame(mp3Encoder, frame, channels), (chunk) =>
							injectMetadata(chunk, state, metadataChunk, metaInterval),
					),
				),
				Stream.concat(
					Stream.fromEffect(
						Effect.map(
							Effect.try({
								try: () => new Uint8Array(mp3Encoder.flush()),
								catch: (e) => new EncodingError({ message: "failed to flush mp3 encoder", cause: e }),
							}),
							(chunk) => injectMetadata(chunk, state, metadataChunk, metaInterval),
						),
					),
				),
			)
		})
		return { encode }
	}),
}) {}
