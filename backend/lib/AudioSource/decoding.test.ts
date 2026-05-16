import { FileSystem } from "@effect/platform"
import { BunFileSystem } from "@effect/platform-bun"
import { itLive } from "@radiant/backend/bun-test-effect"
import {
	DEFAULT_FRAME_SAMPLES,
	DEFAULT_SAMPLE_RATE,
} from "@radiant/backend/services/AudioMultiplexer/constants"
import { describe, expect } from "bun:test"
import { Chunk, Duration, Effect, Fiber, Option, Queue, Stream } from "effect"
import * as AudioSource from "."

const path =
	"/home/tiago/Área de Trabalho/.Atividades/Probe/radiant/backend/services/RadioManager/Fujii Kaze - Matsuri.m4a"

const hasMatsuriFixture = await Bun.file(path).exists()

itLive.layer(BunFileSystem.layer, { testServices: false })((it) => {
	describe.skipIf(!hasMatsuriFixture)("AudioSource.fromEncodedAudioFileStream", () => {
		it.scoped("eventually decodes PCM from a controlled encoded audio stream", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem

				const bytes = yield* fs.readFile(path)
				expect(bytes.length).toBeGreaterThan(0)

				const middle = Math.floor(bytes.length / 2)
				const firstHalf = bytes.subarray(0, middle)
				const secondHalf = bytes.subarray(middle)

				const encodedChunks = yield* Queue.unbounded<Option.Option<Uint8Array>>()

				const controlledEncodedStream = Stream.repeatEffectOption(
					Queue.take(encodedChunks).pipe(
						Effect.flatMap((chunk) =>
							Option.match(chunk, {
								onNone: () => Effect.fail(Option.none()),
								onSome: (bytes) => Effect.succeed(bytes),
							}),
						),
					),
				)

				const source = yield* AudioSource.fromEncodedAudioFileStream(controlledEncodedStream)
				const pull = yield* Stream.toPull(source.stream)

				yield* Queue.offer(encodedChunks, Option.some(firstHalf))

				const firstPullFiber = yield* Effect.fork(pull)

				const firstPullResult = yield* Fiber.join(firstPullFiber).pipe(
					Effect.timeoutOption("500 millis"),
				)

				yield* Queue.offer(encodedChunks, Option.some(secondHalf))
				yield* Queue.offer(encodedChunks, Option.none())

				const firstDecodedChunk = Option.isSome(firstPullResult)
					? firstPullResult.value
					: yield* pull

				expect(Chunk.size(firstDecodedChunk)).toBeGreaterThan(0)

				for (const frame of Chunk.toReadonlyArray(firstDecodedChunk)) {
					expect(frame).toBeInstanceOf(Float32Array)
					expect(frame.length).toBeGreaterThan(0)
				}
			}),
		)

		it.scoped(
			"can emit PCM before the full encoded stream is delivered when the container allows streaming decode",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem

					const bytes = yield* fs.readFile(path)
					expect(bytes.length).toBeGreaterThan(0)

					const middle = Math.floor(bytes.length / 2)
					const firstHalf = bytes.subarray(0, middle)
					const secondHalf = bytes.subarray(middle)

					const encodedChunks = yield* Queue.unbounded<Option.Option<Uint8Array>>()

					const controlledEncodedStream = Stream.repeatEffectOption(
						Queue.take(encodedChunks).pipe(
							Effect.flatMap((chunk) =>
								Option.match(chunk, {
									onNone: () => Effect.fail(Option.none()),
									onSome: (bytes) => Effect.succeed(bytes),
								}),
							),
						),
					)

					const source = yield* AudioSource.fromEncodedAudioFileStream(controlledEncodedStream)
					const pull = yield* Stream.toPull(source.stream)

					yield* Queue.offer(encodedChunks, Option.some(firstHalf))

					const firstPullFiber = yield* Effect.fork(pull)

					const firstPullResult = yield* Fiber.join(firstPullFiber).pipe(
						Effect.timeoutOption("2 seconds"),
					)

					yield* Queue.offer(encodedChunks, Option.some(secondHalf))
					yield* Queue.offer(encodedChunks, Option.none())

					expect(Option.isSome(firstPullResult)).toBe(true)

					if (Option.isSome(firstPullResult)) {
						expect(Chunk.size(firstPullResult.value)).toBeGreaterThan(0)

						for (const frame of Chunk.toReadonlyArray(firstPullResult.value)) {
							expect(frame).toBeInstanceOf(Float32Array)
							expect(frame.length).toBeGreaterThan(0)
						}
					}
				}),
		)
		const meanAbsoluteDifference = (a: Float32Array, b: Float32Array): number => {
			expect(a.length).toBe(b.length)

			let total = 0

			for (let i = 0; i < a.length; i++) {
				total += Math.abs(a[i]! - b[i]!)
			}

			return total / a.length
		}

		it.scoped("honors seek by starting at the expected PCM position", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem

				const bytes = yield* fs.readFile(path)
				expect(bytes.length).toBeGreaterThan(0)

				const framesToSeek = 500
				const seekMs = ((framesToSeek * DEFAULT_FRAME_SAMPLES) / DEFAULT_SAMPLE_RATE) * 1_000

				const referenceSource = yield* AudioSource.fromEncodedAudioFileStream(
					Stream.fromIterable([bytes]),
				)

				const referenceFrames = yield* referenceSource.stream.pipe(
					Stream.drop(framesToSeek),
					Stream.take(3),
					Stream.runCollect,
					Effect.map(Chunk.toReadonlyArray),
				)

				expect(referenceFrames.length).toBe(3)

				const seekedSource = yield* AudioSource.fromEncodedAudioFileStream(
					Stream.fromIterable([bytes]),
					{
						seek: Duration.millis(seekMs),
					},
				)
				const seekedFrames = yield* seekedSource.stream.pipe(
					Stream.take(3),
					Stream.runCollect,
					Effect.map(Chunk.toReadonlyArray),
				)

				expect(seekedFrames.length).toBe(3)

				for (let i = 0; i < 3; i++) {
					const referenceFrame = referenceFrames[i]!
					const seekedFrame = seekedFrames[i]!

					expect(referenceFrame).toBeInstanceOf(Float32Array)
					expect(seekedFrame).toBeInstanceOf(Float32Array)
					expect(referenceFrame.length).toBe(seekedFrame.length)

					const diff = meanAbsoluteDifference(referenceFrame, seekedFrame)

					expect(diff).toBeLessThan(0.0001)
				}
			}),
		)
	})
})
