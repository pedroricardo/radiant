import { describe, expect } from "bun:test"
import { Chunk, Duration, Effect, Fiber, Layer, Stream, TestClock } from "effect"
import { it } from "../../bun-test-effect"
import * as AudioSource from "../../lib/AudioSource"
import { AudioMultiplexer, MultiplexerSourceChannelMismatchError } from "./index"

const FRAME_SAMPLES = 1152
const CHANNELS = 2
const FRAME_LENGTH = FRAME_SAMPLES * CHANNELS
const SAMPLE_RATE = 44_100
const FRAME_DURATION_MS = (FRAME_SAMPLES / SAMPLE_RATE) * 1_000

const constantFrame = (value: number): Float32Array => {
	const frame = new Float32Array(FRAME_LENGTH)
	frame.fill(value)
	return frame
}

const firstSample = (frame: Float32Array): number => frame[0] ?? 0
const collectFrames = <E, R>(
	stream: Stream.Stream<Float32Array, E, R>,
	count: number,
): Effect.Effect<ReadonlyArray<Float32Array>, E, R> =>
	Effect.gen(function* () {
		const fiber = yield* Effect.fork(Stream.runCollect(Stream.take(stream, count)))
		yield* TestClock.adjust(Duration.millis(Math.ceil(FRAME_DURATION_MS * count) + 1))
		const frames = yield* Fiber.join(fiber)
		return Chunk.toReadonlyArray(frames)
	})

describe("AudioMultiplexer", () => {
	it.layer(AudioMultiplexer.Default)((it) => {
		it.effect("emits continuous silence when no cluster is active", () =>
			Effect.gen(function* () {
				const multiplexer = yield* AudioMultiplexer
				const list = yield* collectFrames(multiplexer.outputUnsafe, 2)

				expect(list).toHaveLength(2)
				expect(list[0]?.length).toBe(FRAME_LENGTH)
				expect(list[1]?.length).toBe(FRAME_LENGTH)
				expect(firstSample(list[0] ?? new Float32Array(0))).toBe(0)
				expect(firstSample(list[1] ?? new Float32Array(0))).toBe(0)
			}),
		)

		it.scoped("mixes multiple sources inside one cluster", () =>
			Effect.gen(function* () {
				const multiplexer = yield* AudioMultiplexer
				const sourceA = yield* AudioSource.fromPCM([constantFrame(1)], SAMPLE_RATE, 2)
				const sourceB = yield* AudioSource.fromPCM([constantFrame(0)], SAMPLE_RATE, 2)

				yield* multiplexer.setCluster([
					{ id: "a", source: sourceA },
					{ id: "b", source: sourceB },
				])

				const first = yield* collectFrames(multiplexer.outputUnsafe, 1)
				expect(first).toHaveLength(1)
				expect(firstSample(first[0]!)).toBeCloseTo(0.5, 5)
			}),
		)

		it.scoped("crossfades between clusters", () =>
			Effect.gen(function* () {
				const multiplexer = yield* AudioMultiplexer
				const loud = yield* AudioSource.fromPCM(
					[
						constantFrame(1),
						constantFrame(1),
						constantFrame(1),
						constantFrame(1),
						constantFrame(1),
					],
					SAMPLE_RATE,
					2,
				)
				const quiet = yield* AudioSource.fromPCM(
					[
						constantFrame(0),
						constantFrame(0),
						constantFrame(0),
						constantFrame(0),
						constantFrame(0),
					],
					SAMPLE_RATE,
					2,
				)

				yield* multiplexer.setCluster([{ id: "loud", source: loud }], { crossfadeDuration: 0 })
				const before = yield* collectFrames(multiplexer.outputUnsafe, 1)
				expect(before).toHaveLength(1)
				expect(firstSample(before[0]!)).toBeCloseTo(1, 5)

				yield* multiplexer.setCluster([{ id: "quiet", source: quiet }], {
					crossfadeDuration: "100 millis",
				})
				const during = yield* collectFrames(multiplexer.outputUnsafe, 4)
				const levels = during.map((frame) => firstSample(frame))

				expect(levels[0]).toBeGreaterThan(levels[3] ?? 0)
				expect(levels[3]).toBeLessThan(0.5)
			}),
		)

		it.effect("returns specific error for channel mismatch", () =>
			Effect.gen(function* () {
				const multiplexer = yield* AudioMultiplexer
				const mono = yield* AudioSource.fromPCM([new Float32Array([0.2, 0.2, 0.2])], SAMPLE_RATE, 1)

				const result = yield* Effect.either(multiplexer.setCluster([{ id: "mono", source: mono }]))
				expect(result._tag).toBe("Left")
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(MultiplexerSourceChannelMismatchError)
				}
			}),
		)
	})
})
