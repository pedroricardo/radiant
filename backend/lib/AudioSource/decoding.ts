import {
	DEFAULT_CHANNELS,
	DEFAULT_FRAME_SAMPLES,
	DEFAULT_SAMPLE_RATE,
} from "@radiant/backend/services/AudioMultiplexer/constants"
import { Chunk, Duration, Effect, Fiber, Option, Stream } from "effect"

import { AudioSource, AudioSourceConfigurationError, concatUint8Arrays } from "."
import * as PCM from "../PCM"

export const fromEncodedAudioFileStream = Effect.fn("fromEncodedAudioFileStream")(function* <E>(
	input: Stream.Stream<Uint8Array, E>,
	options?: {
		readonly seek?: Duration.DurationInput
	},
) {
	const sampleRate = DEFAULT_SAMPLE_RATE
	const channels = DEFAULT_CHANNELS
	const frameLength = PCM.frameLength(DEFAULT_FRAME_SAMPLES, channels)
	const frameByteLength = PCM.frameByteLength(DEFAULT_FRAME_SAMPLES, channels)
	const seekMs = options?.seek === undefined ? 0 : Duration.toMillis(options.seek)

	yield* PCM.validateConfig(sampleRate, channels)

	if (!Number.isFinite(seekMs) || seekMs < 0) {
		return yield* Effect.fail(
			new AudioSourceConfigurationError({
				message: `invalid seek duration: ${String(options?.seek)}`,
			}),
		)
	}

	return new AudioSource({
		sampleRate,
		channels,
		stream: Stream.unwrapScoped(
			Effect.gen(function* () {
				const seekArgs = seekMs > 0 ? ["-ss", String(seekMs / 1_000)] : []

				const process = yield* Effect.try({
					try: () =>
						Bun.spawn({
							cmd: [
								"ffmpeg",
								"-v",
								"error",
								"-i",
								"pipe:0",
								...seekArgs,
								"-f",
								"f32le",
								"-acodec",
								"pcm_f32le",
								"-ar",
								String(sampleRate),
								"-ac",
								String(channels),
								"pipe:1",
							],
							stdin: "pipe",
							stdout: "pipe",
							stderr: "pipe",
						}),
					catch: (cause) =>
						new AudioSourceConfigurationError({
							message: `failed to spawn ffmpeg for encoded audio file stream: ${String(cause)}`,
						}),
				})

				yield* Effect.addFinalizer(() =>
					Effect.sync(() => process.kill()).pipe(Effect.ignoreLogged),
				)

				if (process.stdin == null || process.stdout == null || process.stderr == null) {
					return yield* Effect.fail(
						new AudioSourceConfigurationError({
							message: "ffmpeg did not expose piped stdio for encoded audio file stream",
						}),
					)
				}

				const writer = process.stdin

				const stdinFiber = yield* Effect.forkScoped(
					input.pipe(
						Stream.runForEach((chunk) =>
							Effect.tryPromise({
								try: async () => {
									await writer.write(chunk)
								},
								catch: (cause) =>
									new AudioSourceConfigurationError({
										message: `failed to write encoded audio file stream into ffmpeg: ${String(cause)}`,
									}),
							}),
						),
						Effect.mapError(
							(cause) =>
								new AudioSourceConfigurationError({
									message: `encoded audio file stream failed while writing into ffmpeg: ${String(cause)}`,
								}),
						),
						Effect.ensuring(Effect.sync(() => writer.end())),
					),
				)

				const stderrFiber = yield* Effect.forkScoped(
					Effect.promise(() => new Response(process.stderr).text()).pipe(
						Effect.catchAll((cause) =>
							Effect.succeed(
								`failed to read ffmpeg stderr for encoded audio file stream: ${String(cause)}`,
							),
						),
					),
				)

				const bytePull = yield* Stream.toPull(
					Stream.fromReadableStream(
						() => process.stdout!,
						(cause) =>
							new AudioSourceConfigurationError({
								message: `failed to read ffmpeg stdout for encoded audio file stream: ${String(cause)}`,
							}),
					),
				)

				let pendingBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
				let emittedAnyFrame = false

				const pullFrames: Effect.Effect<
					Chunk.Chunk<Float32Array>,
					Option.Option<AudioSourceConfigurationError>
				> = Effect.gen(function* () {
					while (true) {
						if (pendingBytes.length >= frameByteLength) {
							const frameBytes = pendingBytes.subarray(0, frameByteLength)
							const leftovers = pendingBytes.subarray(frameByteLength)

							const frame = PCM.fromInterleavedFloat32Bytes(frameBytes, frameLength)

							pendingBytes = new Uint8Array(leftovers)
							emittedAnyFrame = true

							return Chunk.of(frame)
						}

						const nextChunk = yield* Effect.either(bytePull)

						if (nextChunk._tag === "Right") {
							for (const bytes of Chunk.toReadonlyArray(nextChunk.right)) {
								pendingBytes = concatUint8Arrays(pendingBytes, bytes)
							}

							continue
						}

						if (Option.isSome(nextChunk.left)) {
							return yield* Effect.fail(Option.some(nextChunk.left.value))
						}

						const stdinResult = yield* Fiber.join(stdinFiber).pipe(Effect.either)

						if (stdinResult._tag === "Left") {
							return yield* Effect.fail(
								Option.some(
									new AudioSourceConfigurationError({
										message: `failed to finish writing encoded audio file stream into ffmpeg: ${String(stdinResult.left)}`,
									}),
								),
							)
						}

						const exitCode = yield* Effect.promise(() => process.exited).pipe(
							Effect.mapError((cause) =>
								Option.some(
									new AudioSourceConfigurationError({
										message: `failed waiting for ffmpeg exit for encoded audio file stream: ${String(cause)}`,
									}),
								),
							),
						)

						const stderr = yield* Fiber.join(stderrFiber).pipe(
							Effect.mapError((cause) =>
								Option.some(
									new AudioSourceConfigurationError({
										message: `failed collecting ffmpeg stderr for encoded audio file stream: ${String(cause)}`,
									}),
								),
							),
						)

						if (exitCode !== 0) {
							return yield* Effect.fail(
								Option.some(
									new AudioSourceConfigurationError({
										message: `ffmpeg failed to decode encoded audio file stream: ${stderr}`,
									}),
								),
							)
						}

						if (pendingBytes.length === 0) {
							if (!emittedAnyFrame) {
								emittedAnyFrame = true
								return Chunk.of(PCM.emptyFrame(DEFAULT_FRAME_SAMPLES, channels))
							}

							return yield* Effect.fail(Option.none())
						}

						const alignedByteLength = PCM.alignedFloat32ByteLength(pendingBytes)

						if (alignedByteLength === 0) {
							return yield* Effect.fail(Option.none())
						}

						const frame = PCM.fromPartialInterleavedFloat32Bytes(pendingBytes, frameLength)

						pendingBytes = new Uint8Array(0)
						emittedAnyFrame = true

						return Chunk.of(frame)
					}
				})

				return Stream.repeatEffectChunkOption(pullFrames)
			}),
		),
	})
})
