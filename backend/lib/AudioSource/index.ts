import { FileSystem } from "@effect/platform"
import { AudioSourceConfigurationError } from "@radiant/client/lib/AudioSourceErrors"
import { Chunk, Data, Effect, Fiber, Function, Option, Stream } from "effect"

import {
	DEFAULT_CHANNELS,
	DEFAULT_FRAME_SAMPLES,
	DEFAULT_SAMPLE_RATE,
} from "../../services/AudioMultiplexer/constants"
import * as PCM from "../PCM"

type IsUnion<T, U = T> = T extends any ? ([U] extends [T] ? false : true) : never

type ValidSampleRate<T extends number> = number extends T
	? never
	: IsUnion<T> extends true
		? never
		: T

export * from "@radiant/client/lib/AudioSourceErrors"

export const validateConfig = PCM.validateConfig

export const concatUint8Arrays = (
	left: Uint8Array<ArrayBufferLike>,
	right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBufferLike> => {
	if (left.length === 0) {
		return right
	}

	if (right.length === 0) {
		return left
	}

	const out = new Uint8Array(left.length + right.length)
	out.set(left, 0)
	out.set(right, left.length)

	return out
}

export class AudioSource<
	const SampleRate extends number,
	out E = never,
	out R = never,
> extends Data.TaggedClass("AudioSource")<{
	readonly sampleRate: SampleRate
	readonly channels: number
	readonly stream: Stream.Stream<Float32Array, E, R>
}> {}

export const fromPCM = <const SampleRate extends number>(
	pcm: Float32Array[],
	sampleRate: SampleRate,
	channels = 2,
) =>
	Effect.gen(function* () {
		yield* PCM.validateConfig(sampleRate, channels)

		return new AudioSource({
			sampleRate,
			channels,
			stream: Stream.fromIterable(pcm),
		})
	})

export const fromLiveStream = <const SampleRate extends number, E, R>(
	stream: Stream.Stream<Float32Array, E, R>,
	sampleRate: SampleRate,
	channels = 2,
) =>
	Effect.gen(function* () {
		yield* PCM.validateConfig(sampleRate, channels)

		return new AudioSource({
			sampleRate,
			channels,
			stream,
		})
	})

export const fromAudioFile = Effect.fn("fromAudioFile")(function* (path: string) {
	const fs = yield* FileSystem.FileSystem

	const sampleRate = DEFAULT_SAMPLE_RATE
	const channels = DEFAULT_CHANNELS
	const frameLength = PCM.frameLength(DEFAULT_FRAME_SAMPLES, channels)
	const frameByteLength = PCM.frameByteLength(DEFAULT_FRAME_SAMPLES, channels)

	yield* PCM.validateConfig(sampleRate, channels)

	const exists = yield* fs.exists(path).pipe(
		Effect.mapError(
			(cause) =>
				new AudioSourceConfigurationError({
					message: `failed to check if audio file exists: ${path}: ${String(cause)}`,
				}),
		),
	)

	if (!exists) {
		return yield* Effect.fail(
			new AudioSourceConfigurationError({
				message: `audio file does not exist: ${path}`,
			}),
		)
	}

	return new AudioSource({
		sampleRate,
		channels,
		stream: Stream.unwrapScoped(
			Effect.gen(function* () {
				const process = yield* Effect.try({
					try: () =>
						Bun.spawn({
							cmd: [
								"ffmpeg",
								"-v",
								"error",
								"-i",
								path,
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
							stdout: "pipe",
							stderr: "pipe",
						}),
					catch: (cause) =>
						new AudioSourceConfigurationError({
							message: `failed to spawn ffmpeg for path: ${path}: ${String(cause)}`,
						}),
				})

				yield* Effect.addFinalizer(() =>
					Effect.sync(() => process.kill()).pipe(Effect.ignoreLogged),
				)

				if (process.stdout == null || process.stderr == null) {
					return yield* Effect.fail(
						new AudioSourceConfigurationError({
							message: `ffmpeg did not expose piped stdio for path: ${path}`,
						}),
					)
				}

				const stderrFiber = yield* Effect.forkScoped(
					Effect.promise(() => new Response(process.stderr).text()).pipe(
						Effect.catchAll((cause) =>
							Effect.succeed(`failed to read ffmpeg stderr for ${path}: ${String(cause)}`),
						),
					),
				)

				const bytePull = yield* Stream.toPull(
					Stream.fromReadableStream(
						() => process.stdout!,
						(cause) =>
							new AudioSourceConfigurationError({
								message: `failed to read ffmpeg stdout for path: ${path}: ${String(cause)}`,
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

						const exitCode = yield* Effect.promise(() => process.exited).pipe(
							Effect.mapError((cause) =>
								Option.some(
									new AudioSourceConfigurationError({
										message: `failed waiting for ffmpeg exit for path: ${path}: ${String(cause)}`,
									}),
								),
							),
						)

						const stderr = yield* Fiber.join(stderrFiber).pipe(
							Effect.mapError((cause) =>
								Option.some(
									new AudioSourceConfigurationError({
										message: `failed collecting ffmpeg stderr for path: ${path}: ${String(cause)}`,
									}),
								),
							),
						)

						if (exitCode !== 0) {
							return yield* Effect.fail(
								Option.some(
									new AudioSourceConfigurationError({
										message: `ffmpeg failed to decode audio file: ${path}: ${stderr}`,
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

						const alignedByteLength =
							pendingBytes.length - (pendingBytes.length % Float32Array.BYTES_PER_ELEMENT)

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

export const combineSources = Function.dual<
	<const SampleRate extends number, E2, R2>(
		that: AudioSource<ValidSampleRate<SampleRate>, E2, R2>,
	) => <E1, R1>(
		self: AudioSource<ValidSampleRate<SampleRate>, E1, R1>,
	) => AudioSource<ValidSampleRate<SampleRate>, E1 | E2 | AudioSourceConfigurationError, R1 | R2>,
	<const SampleRate extends number, E1, R1, E2, R2>(
		self: AudioSource<ValidSampleRate<SampleRate>, E1, R1>,
		that: AudioSource<ValidSampleRate<SampleRate>, E2, R2>,
	) => AudioSource<ValidSampleRate<SampleRate>, E1 | E2 | AudioSourceConfigurationError, R1 | R2>
>(2, (self, that) => {
	if (self.channels !== that.channels) {
		return new AudioSource({
			sampleRate: self.sampleRate,
			channels: self.channels,
			stream: Stream.fail(
				new AudioSourceConfigurationError({
					message: `cannot combine sources with different channels: ${self.channels} vs ${that.channels}`,
				}),
			),
		})
	}

	const stream = Stream.zipAllWith(self.stream, {
		other: that.stream,
		onSelf: (a) => a,
		onOther: (b) => b,
		onBoth: (a, b) => PCM.mixFrames(a, b, self.channels),
	})

	return new AudioSource({
		sampleRate: self.sampleRate,
		channels: self.channels,
		stream,
	})
})

export const withVolume = Function.dual<
	(
		volume: number,
	) => <const SampleRate extends number, E, R>(
		self: AudioSource<ValidSampleRate<SampleRate>, E, R>,
	) => AudioSource<ValidSampleRate<SampleRate>, E, R>,
	<const SampleRate extends number, E, R>(
		self: AudioSource<ValidSampleRate<SampleRate>, E, R>,
		volume: number,
	) => AudioSource<ValidSampleRate<SampleRate>, E, R>
>(2, (self, volume) => {
	const stream = self.stream.pipe(Stream.map((frame) => PCM.withVolume(frame, volume)))

	return new AudioSource({
		sampleRate: self.sampleRate,
		channels: self.channels,
		stream,
	})
})

export const resampleTo = Function.dual<
	<const TargetRate extends number>(
		targetRate: TargetRate,
	) => <const SourceRate extends number, E, R>(
		self: AudioSource<SourceRate, E, R>,
	) => AudioSource<TargetRate, E | AudioSourceConfigurationError, R>,
	<const TargetRate extends number, const SourceRate extends number, E, R>(
		self: AudioSource<SourceRate, E, R>,
		targetRate: TargetRate,
	) => AudioSource<TargetRate, E | AudioSourceConfigurationError, R>
>(2, (self, targetRate) => {
	if (!Number.isFinite(targetRate) || targetRate <= 0) {
		return new AudioSource({
			sampleRate: targetRate,
			channels: self.channels,
			stream: Stream.fail(
				new AudioSourceConfigurationError({
					message: `invalid targetRate: ${targetRate}`,
				}),
			),
		})
	}

	if ((self.sampleRate as number) === (targetRate as number)) {
		return new AudioSource({
			sampleRate: targetRate,
			channels: self.channels,
			stream: self.stream,
		})
	}

	const ratio = self.sampleRate / targetRate

	const stream = self.stream.pipe(
		Stream.map((frame) => PCM.resampleInterleavedFrame(frame, ratio, self.channels)),
	)

	return new AudioSource({
		sampleRate: targetRate,
		channels: self.channels,
		stream,
	})
})

export * from "./decoding"
