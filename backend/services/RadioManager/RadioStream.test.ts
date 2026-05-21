import { BunContext } from "@effect/platform-bun"
import { describe, expect } from "bun:test"
import {
	Chunk,
	DateTime,
	Effect,
	Fiber,
	Layer,
	Metric,
	Option,
	Ref,
	Stream,
	TestClock,
} from "effect"
import { it } from "../../bun-test-effect"
import type { Radio } from "../../lib"
import * as AudioSource from "../../lib/AudioSource"
import { makeUnimplementedServiceLayer } from "../../test/support/unimplementedService"
import { AudioMultiplexer } from "../AudioMultiplexer"
import { Drizzle } from "../Drizzle"
import { IcyEncoder as IcyEncoderService } from "../IcyEncoder"
import { MediaLibraryService } from "../MediaLibraryService"
import { PlayoutManager } from "../PlayoutManager"
import { ScheduleBlockService } from "../ScheduleBlockService"
import { StorageService } from "../StorageService"
import { radioListenerConnectionsActive, radioMetric } from "./metrics"
import { RadioManagerConfig } from "./RadioManagerConfig"
import { RadioRepository } from "./RadioRepository"
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

const makeFakeMultiplexer = (frameValueRef: Ref.Ref<number>) =>
	Effect.gen(function* () {
		const outputUnsafe = Stream.repeatEffect(
			Ref.get(frameValueRef).pipe(Effect.map((value) => makeFrame(value))),
		)
		const output = Stream.broadcastDynamic(outputUnsafe, {
			strategy: "sliding",
			capacity: FRAME_LENGTH,
		})

		return AudioMultiplexer.make({
			config: {
				sampleRate: SAMPLE_RATE,
				channels: CHANNELS as 1 | 2,
				frameSamples: FRAME_SAMPLES,
				defaultCrossfadeDuration: "0 millis",
			},
			setCluster: (sources) => Ref.set(frameValueRef, sources.length > 0 ? 1 : 0),
			clearCluster: () => Ref.set(frameValueRef, 0),
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
	})

const makeSequentialFakeMultiplexer = () =>
	Effect.gen(function* () {
		const sequenceRef = yield* Ref.make(0)
		const outputUnsafe = Stream.repeatEffect(
			Ref.updateAndGet(sequenceRef, (sequence) => sequence + 1).pipe(
				Effect.map((sequence) => makeFrame(sequence - 1)),
			),
		)
		const output = Stream.broadcastDynamic(outputUnsafe, {
			strategy: "sliding",
			capacity: FRAME_LENGTH,
		})

		return AudioMultiplexer.make({
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
	})

const syncMultiplexerToRealAudio = (multiplexer: typeof AudioMultiplexer.Service) =>
	multiplexer.setCluster([
		{
			id: "source-1",
			volume: 1,
			source: new AudioSource.AudioSource({
				sampleRate: SAMPLE_RATE,
				channels: CHANNELS,
				stream: Stream.repeatEffect(Effect.succeed(makeFrame(1))),
			}),
		},
	])

const encodeFrameMarker = (value: number): Uint8Array => {
	const bytes = new Uint8Array(4)
	new DataView(bytes.buffer).setUint32(0, value)
	return bytes
}

const decodeFrameMarker = (chunk: Uint8Array): number =>
	new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength).getUint32(0)

const makeFakeIcyEncoderLayer = () =>
	Layer.succeed(
		IcyEncoderService,
		IcyEncoderService.make({
			encode: (source, options) =>
				Effect.succeed({
					metaInterval: options.metaInterval ?? 16_000,
					metadataTitle: options.metadataTitle ?? "Radiant FM",
					kbps: options.kbps,
					channels: source.channels,
					stream: source.stream.pipe(Stream.map((frame) => encodeFrameMarker(firstSample(frame)))),
				}),
		}),
	)

const makeFakeMultiplexerServiceLayer = (frameValueRef: Ref.Ref<number>) =>
	Layer.effect(AudioMultiplexer, makeFakeMultiplexer(frameValueRef))

describe("RadioStream", () => {
	it.scoped("replays the cached window to new subscribers", () =>
		Effect.gen(function* () {
			const frameValueRef = yield* Ref.make(7)
			const multiplexer = yield* makeFakeMultiplexer(frameValueRef)
			const runtime = yield* RadioStream.makeRuntime(multiplexer)

			const frames = yield* Stream.runCollect(Stream.take(runtime.subscribe, 3))

			expect(runtime.frameBufferCapacity).toBe(FRAME_BUFFER_CAPACITY)
			expect(Chunk.size(frames)).toBe(3)
			expect(firstSample(Chunk.unsafeGet(frames, 0))).toBe(7)
			expect(firstSample(Chunk.unsafeGet(frames, 1))).toBe(7)
			expect(firstSample(Chunk.unsafeGet(frames, 2))).toBe(7)
		}),
	)

	it.scoped("fills the first warmup window with the current playout source", () =>
		Effect.gen(function* () {
			const frameValueRef = yield* Ref.make(0)
			const multiplexer = yield* makeFakeMultiplexer(frameValueRef)
			yield* syncMultiplexerToRealAudio(multiplexer)

			const runtime = yield* RadioStream.makeRuntime(multiplexer)
			const frames = yield* Stream.runCollect(Stream.take(runtime.subscribe, 3))

			expect(firstSample(Chunk.unsafeGet(frames, 0))).toBe(1)
			expect(firstSample(Chunk.unsafeGet(frames, 1))).toBe(1)
			expect(firstSample(Chunk.unsafeGet(frames, 2))).toBe(1)
		}),
	)

	it.scoped("does not replay the first 30 second window after the cached prebuffer", () =>
		Effect.gen(function* () {
			const multiplexer = yield* makeSequentialFakeMultiplexer()
			const runtime = yield* RadioStream.makeRuntime(multiplexer)

			const framesFiber = yield* Effect.fork(
				Stream.runCollect(Stream.take(runtime.subscribe, FRAME_BUFFER_CAPACITY + 3)),
			)

			yield* TestClock.adjust(FRAME_DURATION_MS * 3)

			const frames = yield* Fiber.join(framesFiber)

			expect(Chunk.size(frames)).toBe(FRAME_BUFFER_CAPACITY + 3)
			expect(firstSample(Chunk.unsafeGet(frames, 0))).toBe(0)
			expect(firstSample(Chunk.unsafeGet(frames, FRAME_BUFFER_CAPACITY - 1))).toBe(
				FRAME_BUFFER_CAPACITY - 1,
			)
			expect(firstSample(Chunk.unsafeGet(frames, FRAME_BUFFER_CAPACITY))).toBe(
				FRAME_BUFFER_CAPACITY,
			)
			expect(firstSample(Chunk.unsafeGet(frames, FRAME_BUFFER_CAPACITY + 1))).toBe(
				FRAME_BUFFER_CAPACITY + 1,
			)
		}),
	)

	it.scoped("cloneStream does not replay the cached window at the listener boundary", () =>
		Effect.gen(function* () {
			const multiplexer = yield* makeSequentialFakeMultiplexer()
			const runtime = yield* RadioStream.makeRuntime(multiplexer)

			const encoded = yield* RadioStream.cloneStream(
				{
					radioId: "radio_1",
					multiplexer,
					runtime,
					playoutManagerFiber: undefined as never,
				} as never,
				{ kbps: 128 },
			).pipe(Effect.provide(makeFakeIcyEncoderLayer()))

			const chunksFiber = yield* Effect.fork(
				Stream.runCollect(Stream.take(encoded.stream, FRAME_BUFFER_CAPACITY + 3)),
			)

			yield* TestClock.adjust(FRAME_DURATION_MS * 3)

			const chunks = yield* Fiber.join(chunksFiber)
			const markers = Chunk.toReadonlyArray(chunks).map(decodeFrameMarker)

			expect(markers[0]).toBe(0)
			expect(markers[FRAME_BUFFER_CAPACITY - 1]).toBe(FRAME_BUFFER_CAPACITY - 1)
			expect(markers[FRAME_BUFFER_CAPACITY]).toBe(FRAME_BUFFER_CAPACITY)
			expect(markers[FRAME_BUFFER_CAPACITY + 1]).toBe(FRAME_BUFFER_CAPACITY + 1)
		}),
	)

	it.scoped(
		"interrupting cloneStream releases the subscriber and decrements active listeners",
		() =>
			Effect.gen(function* () {
				const radioId = "radio_1" as Radio.RadioId
				const multiplexer = yield* makeSequentialFakeMultiplexer()
				const runtime = yield* RadioStream.makeRuntime(multiplexer, { radioId })

				const encoded = yield* RadioStream.cloneStream(
					{
						radioId,
						multiplexer,
						runtime,
						playoutManagerFiber: undefined as never,
					} as never,
					{ kbps: 128 },
				).pipe(Effect.provide(makeFakeIcyEncoderLayer()))

				const streamFiber = yield* Effect.fork(Stream.runDrain(Stream.take(encoded.stream, 10_000)))

				yield* TestClock.adjust(FRAME_DURATION_MS * 2)

				const activeBeforeInterrupt = yield* Metric.value(
					radioMetric(radioListenerConnectionsActive, radioId),
				)
				expect(activeBeforeInterrupt.value).toBe(1)

				yield* Fiber.interrupt(streamFiber)

				const activeAfterInterrupt = yield* Metric.value(
					radioMetric(radioListenerConnectionsActive, radioId),
				)
				expect(activeAfterInterrupt.value).toBe(0)
			}),
	)

	it.scoped("startRadio syncs the playout exactly once during bootstrap", () =>
		Effect.gen(function* () {
			const frameValueRef = yield* Ref.make(0)
			const syncCallsRef = yield* Ref.make(0)
			const fakePlayoutManager = PlayoutManager.make({
				syncNow: (_radioId, multiplexer) =>
					syncMultiplexerToRealAudio(multiplexer).pipe(Effect.as(Option.none<DateTime.Zoned>())),
				takeover: (_radioId, multiplexer, options) =>
					Ref.update(syncCallsRef, (count) => count + 1).pipe(
						Effect.zipRight(syncMultiplexerToRealAudio(multiplexer)),
						Effect.zipRight(options?.readyLatch?.open ?? Effect.void),
						Effect.zipRight(Effect.never),
					),
			})

			const radioStream = yield* RadioStream.startRadio("radio_1" as Radio.RadioId).pipe(
				Effect.provideService(RadioManagerConfig, {
					audioMultiplexerLayer: makeFakeMultiplexerServiceLayer(frameValueRef),
				}),
				Effect.provideService(PlayoutManager, fakePlayoutManager),
				Effect.provide(
					Layer.mergeAll(
						BunContext.layer,
						makeUnimplementedServiceLayer(MediaLibraryService),
						makeUnimplementedServiceLayer(RadioRepository),
						makeUnimplementedServiceLayer(ScheduleBlockService),
						makeUnimplementedServiceLayer(Drizzle),
						makeUnimplementedServiceLayer(StorageService),
					),
				),
			)

			yield* Effect.addFinalizer(() => RadioStream.stop(radioStream).pipe(Effect.orDie))

			expect(yield* Ref.get(syncCallsRef)).toBe(1)
		}),
	)
})
