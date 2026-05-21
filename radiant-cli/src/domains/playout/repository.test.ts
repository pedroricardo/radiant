import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import * as DateTime from "effect/DateTime"

import { it } from "@radiant/backend/bun-test-effect"
import * as Drizzle from "@radiant/backend/services/Drizzle"
import { mediaNodes } from "@radiant/backend/services/Drizzle/schema/mediaNodes"
import { playlists } from "@radiant/backend/services/Drizzle/schema/playlists"
import { radios } from "@radiant/backend/services/Drizzle/schema/radios"
import { scheduleOneOffBlocks } from "@radiant/backend/services/Drizzle/schema/scheduleOneOffBlocks"
import { scheduleWeeklyBlocks } from "@radiant/backend/services/Drizzle/schema/scheduleWeeklyBlocks"
import { users } from "@radiant/backend/services/Drizzle/schema/user"
import { MediaLibraryService } from "@radiant/backend/services/MediaLibraryService"
import { RadioRepository } from "@radiant/backend/services/RadioManager"
import {
	ScheduleBlockRepositoryLive,
	ScheduleBlockServiceLive,
} from "@radiant/backend/services/ScheduleBlockService"
import { TestDbLayer, resetDb } from "@radiant/backend/test/support/testDb"
import { makeUnimplementedServiceLayer } from "@radiant/backend/test/support/unimplementedService"
import { MediaNode, Playlist, Radio } from "@radiant/client/lib"

import { OverlappingBlockError } from "./errors"
import { insertBlock } from "./repository"

const mediaLibraryMockLayer = makeUnimplementedServiceLayer(MediaLibraryService, {
	getNode: ({ radioId, nodeId }) =>
		Effect.succeed({
			id: nodeId,
			radioId,
			parentId: null,
			kind: "audio_file",
			name: "Track",
			storageKey: `${radioId}/${nodeId}`,
			mimeType: "audio/wav",
			sizeBytes: 1n,
			durationMs: 60_000,
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
			fileHash: null,
			createdAt: DateTime.unsafeFromDate(new Date("2025-01-01T00:00:00Z")),
			updatedAt: DateTime.unsafeFromDate(new Date("2025-01-01T00:00:00Z")),
		}),
})
const radioRepositoryLayer = RadioRepository.Default.pipe(Layer.provideMerge(TestDbLayer))
const scheduleBlockRepositoryLayer = ScheduleBlockRepositoryLive.pipe(
	Layer.provideMerge(TestDbLayer),
)
const scheduleBlockServiceLayer = ScheduleBlockServiceLive.pipe(
	Layer.provideMerge(scheduleBlockRepositoryLayer),
	Layer.provideMerge(radioRepositoryLayer),
)
const testLayer = Layer.mergeAll(
	TestDbLayer,
	mediaLibraryMockLayer,
	radioRepositoryLayer,
	scheduleBlockRepositoryLayer,
	scheduleBlockServiceLayer,
)

const radioId = "radio_test" as Radio.RadioId
const userId = "user_test" as const
const playlistId = "playlist_test" as Playlist.PlaylistId
const mediaNodeId = "media_test" as MediaNode.MediaNodeId

const radio = {
	id: radioId,
	name: "Test Radio",
	description: null,
	timezone: "UTC",
	defaultCrossfadeMs: 0,
	isPublic: false,
	createdByUserId: userId,
	createdAt: "2025-01-01T00:00:00",
	updatedAt: "2025-01-01T00:00:00",
} satisfies typeof radios.$inferSelect

const seedBase = Drizzle.Drizzle.pipe(
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
				name: radio.name,
				timezone: radio.timezone,
				createdByUserId: userId,
			})
			await db.insert(playlists).values({
				id: playlistId,
				radioId,
				name: "Playlist",
			})
			await db.insert(mediaNodes).values({
				id: mediaNodeId,
				radioId,
				parentId: null,
				kind: "audio_file",
				name: "Track",
			})
		}),
	),
)

const oneOffDraft = (startsAtIso: string, endMinuteOfDay: number) => {
	const startsAt = DateTime.unsafeMakeZoned(startsAtIso)
	const parts = DateTime.toParts(startsAt)
	return {
		blockKind: "one-off" as const,
		target: {
			targetType: "audio_file" as const,
			mediaNodeId,
			playlistId: null,
			durationMs: 60_000,
		},
		playbackMode: "continue" as const,
		playlistFillMode: null,
		startsAt,
		date: {
			year: parts.year,
			month: parts.month,
			day: parts.day,
		},
		startMinuteOfDay: parts.hours * 60 + parts.minutes,
		endMinuteOfDay,
	}
}

it.layer(testLayer)(({ scoped }) => {
	scoped("insertBlock rejects overlapping one-off block", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedBase
			const db = yield* Drizzle.Drizzle
			yield* Effect.promise(() =>
				db.insert(scheduleOneOffBlocks).values({
					id: "sob_existing",
					radioId,
					startsAt: "2025-01-06T10:00:00Z",
					endsAt: "2025-01-06T10:30:00Z",
					targetType: "audio_file",
					playlistId: null,
					mediaNodeId,
					playlistFillMode: null,
					playbackMode: "continue",
				}),
			)

			const result = yield* Effect.flip(
				insertBlock(radio, oneOffDraft("2025-01-06T10:15:00Z", 10 * 60 + 45)),
			)
			expect(result).toBeInstanceOf(OverlappingBlockError)
		}),
	)

	scoped("insertBlock rejects overlapping weekly block", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedBase
			const db = yield* Drizzle.Drizzle
			yield* Effect.promise(() =>
				db.insert(scheduleWeeklyBlocks).values({
					id: "swb_existing",
					radioId,
					weekday: 1,
					startMinuteOfDay: 10 * 60,
					endMinuteOfDay: 11 * 60,
					targetType: "audio_file",
					playlistId: null,
					mediaNodeId,
					playlistFillMode: null,
					playbackMode: "continue",
				}),
			)

			const result = yield* Effect.flip(
				insertBlock(radio, {
					blockKind: "weekly",
					target: {
						targetType: "audio_file",
						mediaNodeId,
						playlistId: null,
						durationMs: 60_000,
					},
					playbackMode: "continue",
					playlistFillMode: null,
					weekday: 1,
					startMinuteOfDay: 10 * 60 + 30,
					endMinuteOfDay: 11 * 60 + 30,
				}),
			)
			expect(result).toBeInstanceOf(OverlappingBlockError)
		}),
	)

	scoped("insertBlock rejects one-off block overlapping existing weekly block", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedBase
			const db = yield* Drizzle.Drizzle
			yield* Effect.promise(() =>
				db.insert(scheduleWeeklyBlocks).values({
					id: "swb_existing",
					radioId,
					weekday: 1,
					startMinuteOfDay: 10 * 60,
					endMinuteOfDay: 11 * 60,
					targetType: "audio_file",
					playlistId: null,
					mediaNodeId,
					playlistFillMode: null,
					playbackMode: "continue",
				}),
			)

			const result = yield* Effect.flip(
				insertBlock(radio, oneOffDraft("2025-01-06T10:15:00Z", 10 * 60 + 45)),
			)
			expect(result).toBeInstanceOf(OverlappingBlockError)
		}),
	)
})
