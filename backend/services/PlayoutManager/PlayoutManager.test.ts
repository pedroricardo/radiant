import { MediaNode, Playout, Radio } from "@radiant/client"
import { expect } from "bun:test"
import { DateTime, Effect, Layer, Queue, Ref, Stream, TestClock } from "effect"

import { BunContext } from "@effect/platform-bun"
import { it } from "../../bun-test-effect"
import type { ServiceSpyCall } from "../../test/support/serviceSpy"
import { makeServiceSpy } from "../../test/support/serviceSpy"
import { TestDbLayer, resetDb } from "../../test/support/testDb"
import { makeUnimplementedServiceLayer } from "../../test/support/unimplementedService"
import { AudioMultiplexer } from "../AudioMultiplexer"
import { Drizzle } from "../Drizzle"
import { mediaNodeAudioMetadata } from "../Drizzle/schema/mediaNodeAudioMetadata"
import { mediaNodes } from "../Drizzle/schema/mediaNodes"
import { playlists } from "../Drizzle/schema/playlists"
import { radios } from "../Drizzle/schema/radios"
import { scheduleOneOffBlocks } from "../Drizzle/schema/scheduleOneOffBlocks"
import { scheduleWeeklyBlocks } from "../Drizzle/schema/scheduleWeeklyBlocks"
import { users } from "../Drizzle/schema/user"
import { DatabaseMediaLibraryService } from "../MediaLibraryService"
import { UnimplementedMetadataExtractionService } from "../MetadataExtractionService"
import * as RadioManager from "../RadioManager"
import * as RedisService from "../RedisService"
import type { RedisPubSubMessage } from "../RedisService/RedisPubSub"
import {
	ScheduleBlockService,
	ScheduleBlockRepositoryLive,
	ScheduleBlockServiceLive,
} from "../ScheduleBlockService"
import { StorageService } from "../StorageService"
import { PlayoutManager } from "./PlayoutManager"

const radioId = "radio_test" as Radio.RadioId
const userId = "user_test" as const
const mediaNodeId = "media_test" as MediaNode.MediaNodeId
const mediaNodeIdB = "media_test_b" as MediaNode.MediaNodeId
const playlistId = "playlist_test" as const
const blockDurationMs = 5_000
const longBlockDurationMs = 10_000
const storageObjects = new Map<string, Uint8Array>()

const fakeStorageLayer = makeUnimplementedServiceLayer(StorageService, {
	readObject: (key) =>
		Effect.sync(() => storageObjects.get(key)).pipe(
			Effect.flatMap((bytes) =>
				bytes == null ? Effect.succeed(Stream.empty) : Effect.succeed(Stream.make(bytes)),
			),
		),
})

const infrastructureLayer = Layer.mergeAll(
	TestDbLayer,
	fakeStorageLayer,
	UnimplementedMetadataExtractionService,
)

const radioRepositoryLayer = RadioManager.RadioRepository.Default.pipe(
	Layer.provideMerge(infrastructureLayer),
)

const mediaLibraryLayer = DatabaseMediaLibraryService.pipe(Layer.provideMerge(infrastructureLayer))
const inMemoryRedisPubSubLayer = Layer.effect(
	RedisService.RedisPubSub.RedisPubSub,
	Effect.gen(function* () {
		const subscribersRef = yield* Ref.make(
			[] as ReadonlyArray<Queue.Enqueue<RedisPubSubMessage>>,
		)

		return {
			publish: (channel, message) =>
				Effect.gen(function* () {
					const subscribers = yield* Ref.get(subscribersRef)
					for (const subscriber of subscribers) {
						yield* Queue.offer(subscriber, { channel, message })
					}
					return subscribers.length
				}),
			subscribe: (_channel) =>
				Effect.gen(function* () {
					const queue = yield* Queue.unbounded<RedisPubSubMessage>()
					yield* Ref.update(subscribersRef, (subscribers) => [...subscribers, queue])
					yield* Effect.addFinalizer(() =>
						Ref.update(subscribersRef, (subscribers) =>
							subscribers.filter((subscriber) => subscriber !== queue),
						).pipe(Effect.zipRight(Queue.shutdown(queue))),
					)
					return queue
				}),
			subscribeMany: (_channels) =>
				Effect.gen(function* () {
					const queue = yield* Queue.unbounded<RedisPubSubMessage>()
					yield* Ref.update(subscribersRef, (subscribers) => [...subscribers, queue])
					yield* Effect.addFinalizer(() =>
						Ref.update(subscribersRef, (subscribers) =>
							subscribers.filter((subscriber) => subscriber !== queue),
						).pipe(Effect.zipRight(Queue.shutdown(queue))),
					)
					return queue
				}),
		} satisfies RedisService.RedisPubSub.RedisPubSubShape
	}),
)
const scheduleBlockRepositoryLayer = ScheduleBlockRepositoryLive.pipe(
	Layer.provideMerge(infrastructureLayer),
)
const scheduleBlockServiceLayer = ScheduleBlockServiceLive.pipe(
	Layer.provideMerge(scheduleBlockRepositoryLayer),
	Layer.provideMerge(radioRepositoryLayer),
	Layer.provideMerge(inMemoryRedisPubSubLayer),
)

const playoutManagerLayer = PlayoutManager.Default.pipe(
	Layer.provideMerge(
		Layer.mergeAll(
			infrastructureLayer,
			radioRepositoryLayer,
			mediaLibraryLayer,
			inMemoryRedisPubSubLayer,
			scheduleBlockRepositoryLayer,
			scheduleBlockServiceLayer,
		),
	),
)

const testLayer = Layer.mergeAll(
	infrastructureLayer,
	AudioMultiplexer.Default,
	radioRepositoryLayer,
	mediaLibraryLayer,
	inMemoryRedisPubSubLayer,
	scheduleBlockRepositoryLayer,
	scheduleBlockServiceLayer,
	playoutManagerLayer,
).pipe(Layer.provideMerge(BunContext.layer))

const seedRadio = (timezone: string, mediaDurationMs = blockDurationMs) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(async () => {
				await db.insert(users).values({
					id: userId,
					username: "tester",
					email: "tester@example.com",
					avatarUrl: "https://example.com/avatar.png",
				})
				await db.insert(radios).values({
					id: radioId,
					name: "Test Radio",
					timezone,
					createdByUserId: userId,
				})
				await db.insert(playlists).values({
					id: playlistId,
					radioId,
					name: "Test Playlist",
				})
				await db.insert(mediaNodes).values({
					id: mediaNodeId,
					radioId,
					parentId: null,
					kind: "audio_file",
					name: "Track 1",
				})
				await db.insert(mediaNodeAudioMetadata).values({
					mediaNodeId,
					storageKey: `${radioId}/${mediaNodeId}`,
					durationMs: mediaDurationMs,
					fileHash: "hash_1",
					mimeType: "audio/mp4",
					sizeBytes: 1n,
					containerFormat: "m4a",
					audioCodec: "aac",
					bitrate: 128_000,
					title: null,
					artist: null,
					album: null,
					albumArtist: null,
					genre: null,
					year: null,
					trackNumber: null,
					trackTotal: null,
					diskNumber: null,
					diskTotal: null,
					coverArtStorageKey: null,
					coverArtMimeType: null,
					sampleRate: 44_100,
					channels: 2,
				})
			}),
		),
	)

const seedAudioFileNode = (args: {
	readonly mediaNodeId: MediaNode.MediaNodeId
	readonly name: string
	readonly durationMs: number
}) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(async () => {
				await db.insert(mediaNodes).values({
					id: args.mediaNodeId,
					radioId,
					parentId: null,
					kind: "audio_file",
					name: args.name,
				})
				await db.insert(mediaNodeAudioMetadata).values({
					mediaNodeId: args.mediaNodeId,
					storageKey: `${radioId}/${args.mediaNodeId}`,
					durationMs: args.durationMs,
					fileHash: `hash_${args.mediaNodeId}`,
					mimeType: "audio/wav",
					sizeBytes: 1n,
					containerFormat: "WAVE",
					audioCodec: "PCM",
					bitrate: 1_411_200,
					title: null,
					artist: null,
					album: null,
					albumArtist: null,
					genre: null,
					year: null,
					trackNumber: null,
					trackTotal: null,
					diskNumber: null,
					diskTotal: null,
					coverArtStorageKey: null,
					coverArtMimeType: null,
					sampleRate: 44_100,
					channels: 2,
				})
			}),
		),
	)

const seedOneOffBlock = (startsAtIso: string) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db.insert(scheduleOneOffBlocks).values({
					id: "sob_1",
					radioId,
					startsAt: startsAtIso,
					endsAt: new Date("2025-01-06T10:10:00Z").toISOString(),
					targetType: "audio_file",
					playlistId: null,
					mediaNodeId,
					playlistFillMode: null,
					playbackMode: "continue",
					modeAfterPlayback: "overlay",
				}),
			),
		),
	)

const seedOneOffBlockForNode = (args: {
	readonly id: Playout.ScheduleOneOffBlockId
	readonly startsAtIso: string
	readonly mediaNodeId: MediaNode.MediaNodeId
}) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db.insert(scheduleOneOffBlocks).values({
					id: args.id,
					radioId,
					startsAt: args.startsAtIso,
					endsAt: new Date("2025-01-06T10:10:00Z").toISOString(),
					targetType: "audio_file",
					playlistId: null,
					mediaNodeId: args.mediaNodeId,
					playlistFillMode: null,
					playbackMode: "continue",
					modeAfterPlayback: "overlay",
				}),
			),
		),
	)

const seedWeeklyBlock = () =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db.insert(scheduleWeeklyBlocks).values({
					id: "swb_1",
					radioId,
					weekday: 1,
					startMinuteOfDay: 10 * 60,
					endMinuteOfDay: 10 * 60 + 1,
					targetType: "audio_file",
					playlistId: null,
					mediaNodeId,
					playlistFillMode: null,
					playbackMode: "continue",
				}),
			),
		),
	)

const waitForSetClusterSizes = (
	callsRef: Ref.Ref<ReadonlyArray<ServiceSpyCall<typeof AudioMultiplexer.Service>>>,
	expectedCount: number,
): Effect.Effect<ReadonlyArray<number>> =>
	Effect.gen(function* () {
		while (true) {
			const setClusterSizes = (yield* Ref.get(callsRef))
				.filter((call) => call.method === "setCluster")
				.map((call) => {
					const sources = call.args[0]
					return Array.isArray(sources) ? sources.length : -1
				})
			if (setClusterSizes.length >= expectedCount) {
				return setClusterSizes
			}
			yield* Effect.yieldNow()
		}
	})

const makeSeededNoiseWav = (args: {
	readonly durationMs: number
	readonly seed: number
	readonly amplitude?: number
	readonly sampleRate?: number
	readonly channels?: number
}): Uint8Array => {
	const sampleRate = args.sampleRate ?? 44_100
	const channels = args.channels ?? 2
	const bytesPerSample = 2
	const sampleCount = Math.max(1, Math.round((sampleRate * args.durationMs) / 1000))
	const dataSize = sampleCount * channels * bytesPerSample
	const buffer = new ArrayBuffer(44 + dataSize)
	const view = new DataView(buffer)
	const bytes = new Uint8Array(buffer)
	const writeAscii = (offset: number, value: string) => {
		for (let index = 0; index < value.length; index++) {
			view.setUint8(offset + index, value.charCodeAt(index))
		}
	}

	writeAscii(0, "RIFF")
	view.setUint32(4, 36 + dataSize, true)
	writeAscii(8, "WAVE")
	writeAscii(12, "fmt ")
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, channels, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, sampleRate * channels * bytesPerSample, true)
	view.setUint16(32, channels * bytesPerSample, true)
	view.setUint16(34, 16, true)
	writeAscii(36, "data")
	view.setUint32(40, dataSize, true)

	const amplitude = Math.max(0, Math.min(1, args.amplitude ?? 0.95))
	let state = args.seed | 0
	const nextSample = () => {
		state ^= state << 13
		state ^= state >> 17
		state ^= state << 5
		const normalized = (state >>> 0) / 0xffffffff
		return (normalized * 2 - 1) * amplitude
	}
	for (let sampleIndex = 0; sampleIndex < sampleCount * channels; sampleIndex++) {
		const pcmValue = Math.round(nextSample() * 32_767)
		view.setInt16(44 + sampleIndex * bytesPerSample, pcmValue, true)
	}

	return bytes
}

it.layer(testLayer)(({ scoped }) => {
	scoped("takeover schedules one-off audio blocks at the correct time", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio("UTC")
			yield* seedOneOffBlock("2025-01-06T10:00:10Z")
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))

			const multiplexer = yield* AudioMultiplexer
			const spiedMultiplexer = makeServiceSpy(multiplexer)
			yield* spiedMultiplexer.spy.clear
			const playoutManager = yield* PlayoutManager
			yield* playoutManager.takeover(radioId, spiedMultiplexer.service).pipe(Effect.forkScoped)

			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 1)).toEqual([0])

			yield* TestClock.adjust("10 seconds")
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 2)).toEqual([0, 1])

			yield* TestClock.adjust(blockDurationMs)
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 3)).toEqual([0, 1, 0])
		}),
	)

	scoped("takeover schedules weekly audio blocks at the correct time", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio("UTC")
			yield* seedWeeklyBlock()
			yield* TestClock.setTime(new Date("2025-01-06T09:59:00Z"))

			const multiplexer = yield* AudioMultiplexer
			const spiedMultiplexer = makeServiceSpy(multiplexer)
			yield* spiedMultiplexer.spy.clear
			const playoutManager = yield* PlayoutManager
			yield* playoutManager.takeover(radioId, spiedMultiplexer.service).pipe(Effect.forkScoped)

			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 1)).toEqual([0])

			yield* TestClock.adjust("1 minute")
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 2)).toEqual([0, 1])

			yield* TestClock.adjust(blockDurationMs)
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 3)).toEqual([0, 1, 0])
		}),
	)

	scoped("takeover changes real AudioMultiplexer output when one-off blocks change", () =>
		Effect.gen(function* () {
			yield* resetDb
			storageObjects.clear()
			yield* seedRadio("UTC", longBlockDurationMs)
			yield* seedAudioFileNode({
				mediaNodeId: mediaNodeIdB,
				name: "Track 2",
				durationMs: longBlockDurationMs,
			})
			yield* seedOneOffBlockForNode({
				id: "sob_a" as Playout.ScheduleOneOffBlockId,
				startsAtIso: "2025-01-06T10:00:10Z",
				mediaNodeId,
			})
			yield* seedOneOffBlockForNode({
				id: "sob_b" as Playout.ScheduleOneOffBlockId,
				startsAtIso: "2025-01-06T10:00:20Z",
				mediaNodeId: mediaNodeIdB,
			})
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))

			const firstTrackBytes = makeSeededNoiseWav({
				durationMs: longBlockDurationMs,
				seed: 0x12345678,
			})
			const secondTrackBytes = makeSeededNoiseWav({
				durationMs: longBlockDurationMs,
				seed: 0x87654321,
			})
			storageObjects.set(`${radioId}/${mediaNodeId}`, firstTrackBytes)
			storageObjects.set(`${radioId}/${mediaNodeIdB}`, secondTrackBytes)

			const multiplexer = yield* AudioMultiplexer
			const spiedMultiplexer = makeServiceSpy(multiplexer)
			yield* spiedMultiplexer.spy.clear
			const playoutManager = yield* PlayoutManager
			yield* playoutManager.takeover(radioId, spiedMultiplexer.service).pipe(Effect.forkScoped)
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 1)).toEqual([0])

			yield* TestClock.adjust("10 seconds")
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 2)).toEqual([0, 1])

			yield* TestClock.adjust("10 seconds")
			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 3)).toEqual([0, 1, 1])
			const setClusterCalls = (yield* Ref.get(spiedMultiplexer.spy.calls)).filter(
				(call: { readonly method: string }) => call.method === "setCluster",
			)
			const latestCluster = setClusterCalls[2]!.args[0] as ReadonlyArray<{ readonly id: string }>
			expect(latestCluster).toHaveLength(1)
			expect(latestCluster[0]!.id).toBe(mediaNodeIdB)
		}),
	)

	scoped("schedule block mutations published through Redis resync active runtimes", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio("UTC")
			yield* seedOneOffBlockForNode({
				id: "sob_resync" as Playout.ScheduleOneOffBlockId,
				startsAtIso: "2025-01-06T10:00:20Z",
				mediaNodeId,
			})
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))

			const multiplexer = yield* AudioMultiplexer
			const spiedMultiplexer = makeServiceSpy(multiplexer)
			yield* spiedMultiplexer.spy.clear

			const playoutManager = yield* PlayoutManager
			const scheduleBlockService = yield* ScheduleBlockService
			yield* playoutManager.takeover(radioId, spiedMultiplexer.service).pipe(Effect.forkScoped)

			expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 1)).toEqual([0])

				yield* scheduleBlockService.updateBlock(radioId, "sob_resync", {
					blockKind: "one-off",
					startsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:00:10Z")),
					endsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:00:20Z")),
				})

				yield* TestClock.adjust("250 millis")
				yield* TestClock.adjust("10 seconds")

				expect(yield* waitForSetClusterSizes(spiedMultiplexer.spy.calls, 2)).toEqual([0, 1])
			}),
	)
})
