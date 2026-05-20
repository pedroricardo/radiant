import { Chunk, Duration, Effect, Either, Fiber, Option, Ref, Stream } from "effect"
import {
	DEFAULT_CHANNELS,
	DEFAULT_FRAME_SAMPLES,
	DEFAULT_SAMPLE_RATE,
} from "../../services/AudioMultiplexer/constants"

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

	yield* Effect.logDebug("audio_source.decode.configure").pipe(
		Effect.annotateLogs({
			sampleRate,
			channels,
			seekMs,
			frameLength,
			frameByteLength,
		}),
	)

	return new AudioSource({
		sampleRate,
		channels,
		stream: Stream.unwrapScoped(
			Effect.gen(function* () {
				const stderrTailLimit = 8_000
				const readTimeout = "5 seconds"
				const seekArgs = seekMs > 0 ? ["-ss", String(seekMs / 1_000)] : []
				yield* Effect.logInfo("audio_source.decode.spawn_ffmpeg").pipe(
					Effect.annotateLogs({
						sampleRate,
						channels,
						frameLength,
						seekMs,
					}),
				)

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
					Effect.sync(() => process.kill()).pipe(
						Effect.tap(() =>
							Effect.logDebug("audio_source.decode.ffmpeg_killed").pipe(
								Effect.annotateLogs({ seekMs }),
							),
						),
						Effect.ignoreLogged,
					),
				)

				if (process.stdin == null || process.stdout == null || process.stderr == null) {
					return yield* Effect.fail(
						new AudioSourceConfigurationError({
							message: "ffmpeg did not expose piped stdio for encoded audio file stream",
						}),
					)
				}

				const writer = process.stdin
				const stderrRef = yield* Ref.make("")
				const appendStderr = (text: string) =>
					Ref.update(stderrRef, (current) => (current + text).slice(-stderrTailLimit))

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
				yield* Effect.logDebug("audio_source.decode.stdin_pump_started").pipe(
					Effect.annotateLogs({ seekMs }),
				)

				const stderrFiber = yield* Effect.forkScoped(
					Stream.fromReadableStream(
						() => process.stderr!,
						(cause) =>
							new AudioSourceConfigurationError({
								message: `failed to read ffmpeg stderr for encoded audio file stream: ${String(cause)}`,
							}),
					).pipe(
						Stream.runForEach((chunk) =>
							appendStderr(new TextDecoder().decode(chunk, { stream: true })),
						),
						Effect.catchAll((cause) =>
							appendStderr(
								`\nfailed to read ffmpeg stderr for encoded audio file stream: ${String(cause)}`,
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

						const nextChunk = yield* Effect.either(bytePull).pipe(Effect.timeoutOption(readTimeout))

						if (Option.isNone(nextChunk)) {
							const stderr = yield* Ref.get(stderrRef)
							yield* Effect.logWarning("audio_source.decode.ffmpeg_stdout_timeout").pipe(
								Effect.annotateLogs({ seekMs, readTimeout, stderr }),
							)
							return yield* Effect.fail(
								Option.some(
									new AudioSourceConfigurationError({
										message:
											`ffmpeg stopped producing audio data for encoded audio file stream after ${readTimeout}` +
											(stderr.length > 0 ? `: ${stderr}` : ""),
									}),
								),
							)
						}

						if (Either.isRight(nextChunk.value)) {
							for (const bytes of Chunk.toReadonlyArray(nextChunk.value.right)) {
								pendingBytes = concatUint8Arrays(pendingBytes, bytes)
							}

							continue
						}

						if (Option.isSome(nextChunk.value.left)) {
							return yield* Effect.fail(Option.some(nextChunk.value.left.value))
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

						yield* Fiber.await(stderrFiber).pipe(Effect.ignoreLogged)

						const finalStderr = yield* Ref.get(stderrRef)

						if (exitCode !== 0) {
							yield* Effect.logWarning("audio_source.decode.ffmpeg_failed").pipe(
								Effect.annotateLogs({ exitCode, seekMs, stderr: finalStderr }),
							)
							return yield* Effect.fail(
								Option.some(
									new AudioSourceConfigurationError({
										message:
											`ffmpeg failed to decode encoded audio file stream (exit ${exitCode})` +
											(finalStderr.length > 0 ? `: ${finalStderr}` : ""),
									}),
								),
							)
						}

						if (pendingBytes.length === 0) {
							if (!emittedAnyFrame) {
								yield* Effect.logWarning("audio_source.decode.empty_stream_emits_silence").pipe(
									Effect.annotateLogs({ seekMs, finalStderr }),
								)
								emittedAnyFrame = true
								return Chunk.of(PCM.emptyFrame(DEFAULT_FRAME_SAMPLES, channels))
							}

							yield* Effect.logDebug("audio_source.decode.eof").pipe(
								Effect.annotateLogs({ seekMs }),
							)
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
