import { describe, expect } from "bun:test"
import { Chunk, Effect, Exit, pipe, Stream } from "effect"
import { it } from "../bun-test-effect"
import { AudioSource } from "./index"

describe("AudioSource", () => {
	it.effect("fails for invalid sample rate", () =>
		Effect.gen(function* () {
				const result = yield* Effect.either(AudioSource.fromPCM([], 0, 2))
			expect(result._tag).toBe("Left")
		}),
	)

	it.effect("keeps stream running when one source ends", () =>
		Effect.gen(function* () {
			const left = yield* AudioSource.fromPCM(
				[new Float32Array([0.2, 0.4]), new Float32Array([0.6, 0.8])],
					48_000,
				2,
			)
				const right = yield* AudioSource.fromPCM([new Float32Array([0.8, 0.2])], 48_000, 2)

				const combined = pipe(left, AudioSource.combineSources(right))
			const frames = yield* Stream.runCollect(combined.stream)
			const asArray = Chunk.toReadonlyArray(frames)

			expect(asArray).toHaveLength(2)
			expect(Array.from(asArray[0]!)).toEqual([0.5, 0.30000001192092896])
			expect(Array.from(asArray[1]!)).toEqual([0.6000000238418579, 0.800000011920929])
		}),
	)

	it.effect("fails combine when channels mismatch", () =>
		Effect.gen(function* () {
				const stereo = yield* AudioSource.fromPCM([new Float32Array([0.1, 0.2])], 44_100, 2)
				const mono = yield* AudioSource.fromPCM([new Float32Array([0.1])], 44_100, 1)

				const combined = pipe(stereo, AudioSource.combineSources(mono))
			const exit = yield* Effect.exit(Stream.runCollect(combined.stream))
			expect(Exit.isFailure(exit)).toBe(true)
		}),
	)

	it.effect("resamples interleaved stereo per channel", () =>
		Effect.gen(function* () {
				const source = yield* AudioSource.fromPCM(
					[new Float32Array([1, 10, 2, 20, 3, 30, 4, 40])],
					4,
					2,
				)
				const resampled = pipe(source, AudioSource.resampleTo(2))
			const frames = yield* Stream.runCollect(resampled.stream)
			const asArray = Chunk.toReadonlyArray(frames)

			expect(asArray).toHaveLength(1)
			expect(Array.from(asArray[0]!)).toEqual([1, 10, 3, 30])
		}),
	)
})
