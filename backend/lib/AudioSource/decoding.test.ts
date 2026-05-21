import { FileSystem } from "@effect/platform"
import { BunFileSystem } from "@effect/platform-bun"
import { itLive } from "@radiant/backend/bun-test-effect"
import {
	DEFAULT_FRAME_SAMPLES,
	DEFAULT_SAMPLE_RATE,
} from "@radiant/backend/services/AudioMultiplexer/constants"
import { describe, expect } from "bun:test"
import { Chunk, Duration, Effect, Stream } from "effect"
import * as AudioSource from "."

const path =
	"/home/tiago/Área de Trabalho/.Atividades/Probe/radiant/backend/services/RadioManager/Fujii Kaze - Matsuri.m4a"

const hasMatsuriFixture = await Bun.file(path).exists()

itLive.layer(BunFileSystem.layer, { testServices: false })((it) => {
	describe.skipIf(!hasMatsuriFixture)("AudioSource.fromAudioFile", () => {
		it.scoped("eventually decodes PCM from an audio file", () =>
			Effect.gen(function* () {
				const source = yield* AudioSource.fromAudioFile(path)
				const frames = yield* source.stream.pipe(Stream.take(3), Stream.runCollect)
				expect(Chunk.size(frames)).toBeGreaterThan(0)
				for (const frame of Chunk.toReadonlyArray(frames)) {
					expect(frame).toBeInstanceOf(Float32Array)
					expect(frame.length).toBeGreaterThan(0)
				}
			}),
		)

		it.scoped("can emit early PCM frames from an audio file", () =>
			Effect.gen(function* () {
				const source = yield* AudioSource.fromAudioFile(path)
				const frames = yield* source.stream.pipe(Stream.take(1), Stream.runCollect)
				expect(Chunk.size(frames)).toBe(1)
				const frame = Chunk.toReadonlyArray(frames)[0]!
				expect(frame).toBeInstanceOf(Float32Array)
				expect(frame.length).toBeGreaterThan(0)
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
				const framesToSeek = 500
				const seekMs = ((framesToSeek * DEFAULT_FRAME_SAMPLES) / DEFAULT_SAMPLE_RATE) * 1_000

				const referenceSource = yield* AudioSource.fromAudioFile(path)

				const referenceFrames = yield* referenceSource.stream.pipe(
					Stream.drop(framesToSeek),
					Stream.take(3),
					Stream.runCollect,
					Effect.map(Chunk.toReadonlyArray),
				)

				expect(referenceFrames.length).toBe(3)

				const seekedSource = yield* AudioSource.fromAudioFile(path, {
					seek: Duration.millis(seekMs),
				})
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
