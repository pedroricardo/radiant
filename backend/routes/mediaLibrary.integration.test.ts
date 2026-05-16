import * as RadiantClient from "@radiant/client"
import { expect } from "bun:test"
import { Effect, Layer, Stream } from "effect"

import { RadiantApiImpl } from ".."
import { it } from "../bun-test-effect"
import * as AuthService from "../services/AuthService"
import * as OAuth from "../services/AuthService/oauth"
import { Drizzle } from "../services/Drizzle"
import { radios } from "../services/Drizzle/schema/radios"
import * as MediaLibraryService from "../services/MediaLibraryService"
import * as MetadataExtractionService from "../services/MetadataExtractionService"
import { PlayoutManager } from "../services/PlayoutManager"
import * as RadioManager from "../services/RadioManager"
import * as SessionService from "../services/SessionService"
import * as StorageService from "../services/StorageService"
import * as UserRepository from "../services/UserRepository"
import { makeAuthenticatedFetch, makeClientLayer } from "../test/support/apiClient"
import { TestDbLayer, resetDb } from "../test/support/testDb"

const radioId = "radio_test" as const

const dbLayer = TestDbLayer
const userRepoLayer = UserRepository.UserRepository.Default.pipe(Layer.provideMerge(dbLayer))
const sessionLayer = SessionService.SessionService.Default.pipe(Layer.provideMerge(dbLayer))
const storageObjects = new Map<string, Uint8Array>()
const storageLayer = Layer.succeed(StorageService.StorageService, {
	putObject: ({ key, content }) =>
		Stream.runFold(content, new Uint8Array(0), (acc, chunk) => {
			const merged = new Uint8Array(acc.length + chunk.length)
			merged.set(acc, 0)
			merged.set(chunk, acc.length)
			return merged
		}).pipe(
			Effect.tap((bytes) =>
				Effect.sync(() => {
					storageObjects.set(key, bytes)
				}),
			),
			Effect.mapError(
				(cause) =>
					new StorageService.StorageServiceError({
						message: "storage spy failed during integration upload",
						cause,
					}),
			),
		),
	readObject: (key) =>
		Effect.sync(() => storageObjects.get(key)).pipe(
			Effect.flatMap((bytes) =>
				bytes
					? Effect.succeed(Stream.make(bytes))
					: Effect.fail(
							new StorageService.StorageServiceError({
								message: "storage spy could not find the requested object",
								cause: key,
							}),
						),
			),
		),
	moveObject: (_args) => Effect.void,
	deleteObject: (key) =>
		Effect.sync(() => {
			storageObjects.delete(key)
		}),
})
const metadataExtractionLayer = Layer.succeed(MetadataExtractionService.MetadataExtractionService, {
	extractAudioMetadata: (args: {
		readonly name: string
		readonly contentType?: string | undefined
		readonly content: Stream.Stream<Uint8Array, unknown>
	}) =>
		Stream.runDrain(args.content).pipe(
			Effect.mapError(
				(cause) =>
					new MetadataExtractionService.MetadataExtractionError({
						message: "metadata extraction spy failed during integration upload",
						cause,
					}),
			),
			Effect.as({
				durationMs: 500,
				containerFormat: "WAVE",
				audioCodec: "PCM",
				bitrate: 705600,
				title: "Preview Theme",
				artist: "Integration Artist",
				album: "Integration Album",
				albumArtist: "Integration Album Artist",
				genre: "Integration Test",
				year: 2026,
				trackNumber: 2,
				trackTotal: 12,
				diskNumber: 1,
				diskTotal: 1,
				coverArt: {
					data: new Uint8Array([7, 8, 9]),
					mimeType: "image/png",
				},
				sampleRate: 44100,
				channels: 1,
				mimeType: args.contentType ?? null,
			}),
		),
})
const mediaLibraryLayer = MediaLibraryService.DatabaseMediaLibraryService.pipe(
	Layer.provide(dbLayer),
	Layer.provide(metadataExtractionLayer),
	Layer.provide(storageLayer),
)
const oauthRegistryLayer = OAuth.OAuthProvidersRegistry.Default
const accountLinkLayer = OAuth.AccountLinkService.layerDrizzle.pipe(
	Layer.provide(dbLayer),
	Layer.provide(userRepoLayer),
)
const authServiceLayer = AuthService.AuthService.Default.pipe(
	Layer.provide(OAuth.OAuthProvidersRegistry.Default),
	Layer.provide(accountLinkLayer),
	Layer.provide(userRepoLayer),
)
const oauthStateCheckerLayer = OAuth.layerDrizzle.pipe(Layer.provide(dbLayer))
const radioManagerLayer = RadioManager.RadioManager.Default.pipe(
	Layer.provide(PlayoutManager.Default),
	Layer.provide(RadioManager.RadioRepository.Default),
	Layer.provide(mediaLibraryLayer),
	Layer.provide(dbLayer),
)

const makeSilentWav = (durationMs: number) => {
	const sampleRate = 44_100
	const channels = 1
	const bytesPerSample = 2
	const sampleCount = Math.max(1, Math.round((sampleRate * durationMs) / 1000))
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
	bytes.fill(0, 44)
	return bytes
}

const seedRadio = (userId: `user_${string}`) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db.insert(radios).values({
					id: radioId,
					name: "Test Radio",
					timezone: "Europe/Lisbon",
					createdByUserId: userId,
				}),
			),
		),
	)

it.layer(
	RadiantApiImpl.pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				mediaLibraryLayer,
				oauthRegistryLayer,
				authServiceLayer,
				metadataExtractionLayer,
				oauthStateCheckerLayer,
				radioManagerLayer,
				sessionLayer,
				userRepoLayer,
				dbLayer,
			),
		),
	),
)(({ scoped }) => {
	scoped("MediaLibrary API works in-process through RadiantClient", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* Effect.sync(() => storageObjects.clear())

			const userRepo = yield* UserRepository.UserRepository
			const sessionService = yield* SessionService.SessionService
			const userId = yield* userRepo.createUser({
				username: "alice",
				email: "alice@example.com",
				avatarUrl: "https://example.com/avatar.png",
			})
			yield* seedRadio(userId)
			const sessionId = yield* sessionService.createSessionForUser(userId)
			const clientLayer = yield* makeClientLayer(sessionId)
			const authenticatedFetch = yield* makeAuthenticatedFetch(sessionId)

			const createdFolder = yield* RadiantClient.RadiantClient.use((client) =>
				client.mediaLibrary.createFolder({
					path: { radioId },
					payload: { parentId: null, name: "Music" },
				}),
			).pipe(Effect.provide(clientLayer))

			expect(createdFolder.name).toBe("Music")
			expect(createdFolder.kind).toBe("folder")

			const tree = yield* RadiantClient.RadiantClient.use((client) =>
				client.mediaLibrary.getTree({
					path: { radioId },
				}),
			).pipe(Effect.provide(clientLayer))

			expect(tree).toHaveLength(1)
			expect(tree[0]?.name).toBe("Music")

			const uploadResponse = yield* Effect.promise(() =>
				authenticatedFetch(
					`http://local/api/radios/${radioId}/media-library/files?name=Preview.wav`,
					{
						method: "POST",
						headers: {
							"content-type": "audio/wav",
						},
						body: makeSilentWav(500),
					},
				),
			)
			expect(uploadResponse.status).toBe(200)
			const uploadedNode = yield* Effect.promise<RadiantClient.MediaNode.MediaNode>(
				() => uploadResponse.json() as Promise<RadiantClient.MediaNode.MediaNode>,
			)
			expect(uploadedNode.name).toBe("Preview.wav")
			expect(uploadedNode.kind).toBe("audio_file")
			expect(uploadedNode.title).toBe("Preview Theme")
			expect(uploadedNode.artist).toBe("Integration Artist")
			expect(typeof uploadedNode.coverArtStorageKey).toBe("string")
			expect(uploadedNode.coverArtMimeType).toBe("image/png")

			const treeAfterUpload = yield* RadiantClient.RadiantClient.use((client) =>
				client.mediaLibrary.getTree({
					path: { radioId },
				}),
			).pipe(Effect.provide(clientLayer))
			expect(treeAfterUpload).toHaveLength(2)
			expect(treeAfterUpload.find((node) => node.name === "Preview.wav")?.kind).toBe("audio_file")

			const coverArtResponse = yield* Effect.promise(() =>
				authenticatedFetch(
					`http://local/api/radios/${radioId}/media-library/nodes/${uploadedNode.id}/cover-art`,
				),
			)
			expect(coverArtResponse.status).toBe(200)
			expect(coverArtResponse.headers.get("content-type")).toBe("image/png")
			const coverArtBytes = new Uint8Array(
				yield* Effect.promise(() => coverArtResponse.arrayBuffer()),
			)
			expect(Array.from(coverArtBytes)).toEqual([7, 8, 9])

			const storageInfo = yield* RadiantClient.RadiantClient.use((client) =>
				client.users.getSelfStorage(),
			).pipe(Effect.provide(clientLayer))
			expect(storageInfo.quotaBytes).toBe(BigInt(5_000_000_000))
			expect(storageInfo.usedBytes).toBeGreaterThan(BigInt(0))
			expect(storageInfo.remainingBytes).toBe(storageInfo.quotaBytes - storageInfo.usedBytes)
		}),
	)
})
