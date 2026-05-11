import { describe, expect } from "bun:test"
import { Chunk, Effect, Ref, Stream, TestClock } from "effect"
import * as AudioSource from "$lib/AudioSource"
import { it } from "../../bun-test-effect"
import { AudioMultiplexer } from "../AudioMultiplexer"
import * as RadioStream from "./RadioStream"

const FRAME_SAMPLES = 1152
const CHANNELS = 2
const SAMPLE_RATE = 44_100
const FRAME_LENGTH = FRAME_SAMPLES * CHANNELS
const FRAME_DURATION_MS = (FRAME_SAMPLES / SAMPLE_RATE) * 1_000
const TARGET_BUFFER_MS = 30_000
const FRAME_BUFFER_CAPACITY = Math.ceil(TARGET_BUFFER_MS / FRAME_DURATION_MS)

const makeFrame = (value: number): Float32Array => {
	const frame = new Float32Array(FRAME_LENGTH)
	frame.fill(value)
	return frame
}

const firstSample = (frame: Float32Array): number => frame[0] ?? 0

const makeFakeMultiplexerLayer = () =>
	Effect.gen(function* () {
		const producedFramesRef = yield* Ref.make(0)
		const sequenceRef = yield* Ref.make(0)

		const outputUnsafe = Stream.repeatEffect(
			Ref.updateAndGet(sequenceRef, (sequence) => sequence + 1).pipe(
				Effect.map((sequence) => makeFrame(sequence - 1)),
				Effect.tap(() => Ref.update(producedFramesRef, (count) => count + 1)),
			),
		)
		const output = Stream.broadcastDynamic(outputUnsafe, {
			strategy: "sliding",
			capacity: FRAME_LENGTH,
		})

		const multiplexer = AudioMultiplexer.make({
			config: {
				sampleRate: SAMPLE_RATE,
				channels: CHANNELS as 1 | 2,
				frameSamples: FRAME_SAMPLES,
				defaultCrossfadeDuration: "0 millis",
			},
			setCluster: () => Effect.void,
			clearCluster: () => Effect.void,
			setMasterVolume: () => Effect.void,
			output,
			outputUnsafe,
			asAudioSource: output.pipe(
				Effect.map(
					(stream) =>
						new AudioSource.AudioSource({
							sampleRate: SAMPLE_RATE,
							channels: CHANNELS,
							stream,
						}),
				),
			),
		})
		return {
			multiplexer,
			producedFramesRef,
		}
	})

describe("RadioStream", () => {
	it.scoped("prebuffers 30 seconds before throttling the producer", () =>
		Effect.gen(function* () {
			const { multiplexer, producedFramesRef } = yield* makeFakeMultiplexerLayer()
			const runtime = yield* RadioStream.makeRuntime(multiplexer)

			const frames = yield* Stream.runCollect(
				Stream.take(runtime.subscribe, FRAME_BUFFER_CAPACITY),
			)
			const producedFrames = yield* Ref.get(producedFramesRef)

			expect(runtime.frameBufferCapacity).toBe(FRAME_BUFFER_CAPACITY)
			expect(Chunk.size(frames)).toBe(FRAME_BUFFER_CAPACITY)
			expect(firstSample(Chunk.unsafeGet(frames, 0))).toBe(0)
			expect(firstSample(Chunk.unsafeGet(frames, FRAME_BUFFER_CAPACITY - 1))).toBe(
				FRAME_BUFFER_CAPACITY - 1,
			)
			expect(producedFrames).toBe(FRAME_BUFFER_CAPACITY)
		}),
	)

	it.scoped("slides the cached window forward as test time advances", () =>
		Effect.gen(function* () {
			const { multiplexer, producedFramesRef } = yield* makeFakeMultiplexerLayer()
			const runtime = yield* RadioStream.makeRuntime(multiplexer)

			yield* Stream.runDrain(Stream.take(runtime.subscribe, FRAME_BUFFER_CAPACITY))

			yield* TestClock.adjust("1 second")

			const shiftedWindow = yield* Stream.runCollect(Stream.take(runtime.subscribe, 3))
			const producedFrames = yield* Ref.get(producedFramesRef)
			const expectedShift = Math.floor(1_000 / FRAME_DURATION_MS)

			expect(firstSample(Chunk.unsafeGet(shiftedWindow, 0))).toBe(expectedShift)
			expect(firstSample(Chunk.unsafeGet(shiftedWindow, 1))).toBe(expectedShift + 1)
			expect(firstSample(Chunk.unsafeGet(shiftedWindow, 2))).toBe(expectedShift + 2)
			expect(producedFrames).toBe(FRAME_BUFFER_CAPACITY + expectedShift)
		}),
	)
})
