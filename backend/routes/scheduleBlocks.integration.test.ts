import * as RadiantClient from "@radiant/client"
import { expect } from "bun:test"
import { DateTime, Effect, Layer } from "effect"

import { BunContext } from "@effect/platform-bun"
import { RadiantApiImpl } from ".."
import { it } from "../bun-test-effect"
import * as AuthService from "../services/AuthService"
import * as OAuth from "../services/AuthService/oauth"
import { Drizzle } from "../services/Drizzle"
import { mediaNodes } from "../services/Drizzle/schema/mediaNodes"
import { playlists } from "../services/Drizzle/schema/playlists"
import { radios } from "../services/Drizzle/schema/radios"
import * as MediaLibraryService from "../services/MediaLibraryService"
import * as RadioManager from "../services/RadioManager"
import * as RedisService from "../services/RedisService"
import {
	ScheduleBlockRepositoryLive,
	ScheduleBlockServiceLive,
} from "../services/ScheduleBlockService"
import * as SessionService from "../services/SessionService"
import * as UserRepository from "../services/UserRepository"
import { makeClientLayer } from "../test/support/apiClient"
import { TestDbLayer, resetDb } from "../test/support/testDb"
import { makeUnimplementedServiceLayer } from "../test/support/unimplementedService"

const radioId = "radio_test" as const
const playlistId = "playlist_test" as const
const mediaNodeId = "media_test" as const

const dbLayer = TestDbLayer
const userRepoLayer = UserRepository.UserRepository.Default.pipe(Layer.provideMerge(dbLayer))
const sessionLayer = SessionService.SessionService.Default.pipe(Layer.provideMerge(dbLayer))
const oauthRegistryLayer = OAuth.OAuthProvidersRegistry.Default
const accountLinkLayer = OAuth.AccountLinkService.layerDrizzle.pipe(
	Layer.provideMerge(dbLayer),
	Layer.provideMerge(userRepoLayer),
)
const authServiceLayer = AuthService.AuthService.Default.pipe(
	Layer.provideMerge(oauthRegistryLayer),
	Layer.provideMerge(accountLinkLayer),
	Layer.provideMerge(userRepoLayer),
)
const oauthStateCheckerLayer = OAuth.layerDrizzle.pipe(Layer.provideMerge(dbLayer))
const radioRepositoryLayer = RadioManager.RadioRepository.Default.pipe(Layer.provideMerge(dbLayer))
const mediaLibraryLayer = makeUnimplementedServiceLayer(MediaLibraryService.MediaLibraryService)
const radioManagerLayer = Layer.effect(
	RadioManager.RadioManager,
	Effect.gen(function* () {
		const repository = yield* RadioManager.RadioRepository
		return {
			_tag: "RadioManager" as const,
			getUserRadioInfo: repository.getUserRadioInfo,
			getRadioInfo: repository.getRadioInfo,
			listUserRadios: repository.listUserRadios,
			createRadio: repository.createRadio,
			updateRadio: repository.updateRadio,
			updateUserRadio: repository.updateUserRadio,
			deleteRadio: repository.deleteRadio,
			deleteUserRadio: repository.deleteUserRadio,
			getStream: (_radioId: `radio_${string}`) =>
				Effect.dieMessage("schedule blocks integration test should not request live radio streams"),
		}
	}),
).pipe(Layer.provide(radioRepositoryLayer))
const scheduleBlockRepositoryLayer = ScheduleBlockRepositoryLive.pipe(Layer.provideMerge(dbLayer))
const scheduleBlockServiceLayer = ScheduleBlockServiceLive.pipe(
	Layer.provideMerge(scheduleBlockRepositoryLayer),
	Layer.provideMerge(radioRepositoryLayer),
	Layer.provideMerge(RedisService.RedisPubSub.NoopRedisPubSub),
)
const utc = (iso: string): DateTime.Utc => DateTime.unsafeFromDate(new Date(iso))

const apiLayer = RadiantApiImpl.pipe(
	Layer.provide(
		Layer.mergeAll(
			oauthRegistryLayer,
			accountLinkLayer,
			authServiceLayer,
			oauthStateCheckerLayer,
			mediaLibraryLayer,
			radioRepositoryLayer,
			radioManagerLayer,
			scheduleBlockRepositoryLayer,
			scheduleBlockServiceLayer,
			sessionLayer,
			userRepoLayer,
			dbLayer,
		),
	),
	Layer.provide(BunContext.layer),
)

const seedBase = (userId: `user_${string}`) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(async () => {
				await db.insert(radios).values({
					id: radioId,
					name: "Schedule Test Radio",
					timezone: "UTC",
					createdByUserId: userId,
				})
				await db.insert(playlists).values({
					id: playlistId,
					radioId,
					name: "Main Playlist",
				})
				await db.insert(mediaNodes).values({
					id: mediaNodeId,
					radioId,
					parentId: null,
					kind: "audio_file",
					name: "Track A",
				})
			}),
		),
	)

it.layer(Layer.mergeAll(apiLayer, userRepoLayer, sessionLayer, dbLayer))(({ scoped }) => {
	scoped("schedule blocks API creates and lists weekly rules with occurrences", () =>
		Effect.gen(function* () {
			yield* resetDb

			const userRepo = yield* UserRepository.UserRepository
			const sessionService = yield* SessionService.SessionService
			const userId = yield* userRepo.createUser({
				username: "alice",
				email: "alice@example.com",
				avatarUrl: "https://example.com/avatar.png",
			})
			yield* seedBase(userId)
			const sessionId = yield* sessionService.createSessionForUser(userId)
			const clientLayer = yield* makeClientLayer(sessionId)

			const created = yield* RadiantClient.RadiantClient.use((client) =>
				client.scheduleBlocks.createBlock({
					path: { radioId },
					payload: {
						blockKind: "weekly",
						weekday: 1,
						startMinuteOfDay: 600,
						endMinuteOfDay: 660,
						playbackMode: "continue",
						modeAfterPlayback: "overlay",
						target: {
							targetType: "playlist",
							playlistId,
							mediaNodeId: null,
							playlistFillMode: "once",
						},
					},
				}),
			).pipe(Effect.provide(clientLayer))

			expect(created.blockKind).toBe("weekly")

			const listed = yield* RadiantClient.RadiantClient.use((client) =>
				client.scheduleBlocks.listBlocks({
					path: { radioId },
					urlParams: {
						rangeStart: "2025-01-06T00:00:00Z",
						rangeEnd: "2025-01-13T00:00:00Z",
					},
				}),
			).pipe(Effect.provide(clientLayer))

			expect(listed.weekly.rules).toHaveLength(1)
			expect(listed.weekly.occurrences).toHaveLength(1)
			expect(listed.oneOff.items).toHaveLength(0)
		}),
	)

	scoped("schedule blocks API rejects collisions and validate does not persist", () =>
		Effect.gen(function* () {
			yield* resetDb

			const userRepo = yield* UserRepository.UserRepository
			const sessionService = yield* SessionService.SessionService
			const userId = yield* userRepo.createUser({
				username: "bob",
				email: "bob@example.com",
				avatarUrl: "https://example.com/avatar-bob.png",
			})
			yield* seedBase(userId)
			const sessionId = yield* sessionService.createSessionForUser(userId)
			const clientLayer = yield* makeClientLayer(sessionId)

			yield* RadiantClient.RadiantClient.use((client) =>
				client.scheduleBlocks.createBlock({
					path: { radioId },
					payload: {
						blockKind: "one-off",
						startsAt: utc("2025-01-06T10:00:00Z"),
						endsAt: utc("2025-01-06T10:30:00Z"),
						playbackMode: "continue",
						modeAfterPlayback: "overlay",
						target: {
							targetType: "audio_file",
							playlistId: null,
							mediaNodeId,
							playlistFillMode: null,
						},
					},
				}),
			).pipe(Effect.provide(clientLayer))

			const validation = yield* RadiantClient.RadiantClient.use((client) =>
				client.scheduleBlocks.validateBlock({
					path: { radioId },
					payload: {
						candidate: {
							blockKind: "one-off",
							startsAt: utc("2025-01-06T10:15:00Z"),
							endsAt: utc("2025-01-06T10:45:00Z"),
							playbackMode: "continue",
							modeAfterPlayback: "overlay",
							target: {
								targetType: "audio_file",
								playlistId: null,
								mediaNodeId,
								playlistFillMode: null,
							},
						},
						range: {
							rangeStart: utc("2025-01-06T00:00:00Z"),
							rangeEnd: utc("2025-01-07T00:00:00Z"),
						},
					},
				}),
			).pipe(Effect.provide(clientLayer))

			expect(validation.ok).toBe(false)
			expect(validation.conflicts).toHaveLength(1)

			const createError = yield* RadiantClient.RadiantClient.use((client) =>
				client.scheduleBlocks
					.createBlock({
						path: { radioId },
						payload: {
							blockKind: "one-off",
							startsAt: utc("2025-01-06T10:15:00Z"),
							endsAt: utc("2025-01-06T10:45:00Z"),
							playbackMode: "continue",
							modeAfterPlayback: "overlay",
							target: {
								targetType: "audio_file",
								playlistId: null,
								mediaNodeId,
								playlistFillMode: null,
							},
						},
					})
					.pipe(Effect.flip),
			).pipe(Effect.provide(clientLayer))

			expect(createError._tag).toBe("ScheduleBlockConflictError")

			const listed = yield* RadiantClient.RadiantClient.use((client) =>
				client.scheduleBlocks.listBlocks({
					path: { radioId },
					urlParams: {
						rangeStart: "2025-01-06T00:00:00Z",
						rangeEnd: "2025-01-07T00:00:00Z",
					},
				}),
			).pipe(Effect.provide(clientLayer))

			expect(listed.oneOff.items).toHaveLength(1)
		}),
	)
})
