import { expect, mock } from "bun:test"
import { eq } from "drizzle-orm"
import { Effect, Layer, Stream } from "effect"

import { it } from "../../bun-test-effect"
import { TestDbLayer, resetDb } from "../../test/support/testDb"
import { Drizzle } from "../Drizzle"
import { mediaNodeAudioMetadata } from "../Drizzle/schema/mediaNodeAudioMetadata"
import { mediaNodes } from "../Drizzle/schema/mediaNodes"
import * as MetadataExtractionService from "../MetadataExtractionService"
import { radios } from "../Drizzle/schema/radios"
import { users } from "../Drizzle/schema/user"
import {
	DatabaseMediaLibraryService,
	MediaLibraryService,
} from "./MediaLibraryService"
import { StorageService, StorageServiceError } from "../StorageService"

const radioId = "radio_test" as const
const userId = "user_test" as const

const storageSpy = {
	putObject: mock((args: {
		readonly radioId: string
		readonly key: string
		readonly content: Stream.Stream<Uint8Array, unknown>
		readonly contentType?: string | undefined
	}) =>
		Stream.runDrain(args.content).pipe(
			Effect.mapError(
				(cause) =>
					new StorageServiceError({
						message: "storage spy failed to consume the upload stream",
						cause,
					}),
			),
		)),
	readObject: mock((_key: string) => Effect.dieMessage("readObject not needed in MediaLibraryService tests")),
	moveObject: mock((_args: { readonly fromKey: string; readonly toKey: string }) => Effect.void),
	deleteObject: mock((_key: string) => Effect.void),
}

const fakeStorageLayer = Layer.succeed(StorageService, storageSpy)

const metadataExtractionSpy = {
	extractAudioMetadata: (args: {
		readonly name: string
		readonly contentType?: string | undefined
		readonly content: Stream.Stream<Uint8Array, unknown>
	}) =>
		Stream.runDrain(args.content).pipe(
			Effect.mapError(
				(cause) =>
					new MetadataExtractionService.MetadataExtractionError({
						message: "metadata extraction spy failed to consume the upload stream",
						cause,
					}),
			),
			Effect.as({
				durationMs: 180000,
				containerFormat: "WAVE",
				audioCodec: "PCM",
				bitrate: 705600,
				title: "Intro Theme",
				artist: "Radiant Test Artist",
				album: "Radiant Test Album",
				albumArtist: "Radiant Test Album Artist",
				genre: "Test",
				year: 2025,
				trackNumber: 1,
				trackTotal: 10,
				diskNumber: 1,
				diskTotal: 1,
				coverArt: {
					data: new Uint8Array([1, 2, 3, 4]),
					mimeType: "image/png",
				},
				sampleRate: 44100,
				channels: 1,
				mimeType: args.contentType ?? null,
			}),
		),
}

const fakeMetadataExtractionLayer = Layer.succeed(
	MetadataExtractionService.MetadataExtractionService,
	metadataExtractionSpy,
)

const mediaLibraryLayer = DatabaseMediaLibraryService.pipe(
	Layer.provideMerge(TestDbLayer),
	Layer.provideMerge(fakeMetadataExtractionLayer),
	Layer.provideMerge(fakeStorageLayer),
)

const baseLayer = Layer.mergeAll(
	TestDbLayer,
	fakeStorageLayer,
	fakeMetadataExtractionLayer,
	mediaLibraryLayer,
)

const seedNode = (values: Partial<typeof mediaNodes.$inferInsert> & Pick<typeof mediaNodes.$inferInsert, "id" | "kind" | "name">) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db.insert(mediaNodes).values({
					radioId,
					parentId: null,
					...values,
				}),
			),
		),
	)

const seedAudioMetadata = (
	values: Partial<typeof mediaNodeAudioMetadata.$inferInsert> &
		Pick<
			typeof mediaNodeAudioMetadata.$inferInsert,
			"mediaNodeId" | "storageKey" | "durationMs" | "fileHash"
		>,
) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db.insert(mediaNodeAudioMetadata).values({
					mimeType: null,
					sizeBytes: null,
					containerFormat: null,
					audioCodec: null,
					bitrate: null,
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
					sampleRate: null,
					channels: null,
					...values,
				}),
			),
		),
	)

const seedRadio = () =>
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
					timezone: "Europe/Lisbon",
					createdByUserId: userId,
				})
			}),
		),
	)

const setUserStorageQuota = (storageQuotaBytes: bigint | null) =>
	Drizzle.pipe(
		Effect.flatMap((db) =>
			Effect.promise(() =>
				db
					.update(users)
					.set({ storageQuotaBytes })
					.where(eq(users.id, userId)),
			),
		),
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

it.layer(baseLayer)(({ scoped }) => {
	scoped("getTree returns nested tree from media_nodes", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* seedNode({ id: "media_music", kind: "folder", name: "Music" })
			yield* seedNode({
				id: "media_jpop",
				parentId: "media_music",
				kind: "folder",
				name: "J-Pop",
			})
			yield* seedNode({
				id: "media_track",
				parentId: "media_jpop",
				kind: "audio_file",
				name: "Track A.mp3",
			})
			yield* seedAudioMetadata({
				mediaNodeId: "media_track",
				storageKey: "track-a",
				durationMs: 180000,
				fileHash: "track-a-hash",
			})

			const mediaLibrary = yield* MediaLibraryService
			const tree = yield* mediaLibrary.getTree(radioId)

			expect(tree).toHaveLength(1)
			expect(tree[0]?.name).toBe("Music")
			expect(tree[0]?.children[0]?.name).toBe("J-Pop")
			expect(tree[0]?.children[0]?.children[0]?.name).toBe("Track A.mp3")
		}),
	)

	scoped("createFolder creates root and nested folders", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()

			const mediaLibrary = yield* MediaLibraryService
			const root = yield* mediaLibrary.createFolder({
				radioId,
				parentId: null,
				name: "Music",
			})
			const child = yield* mediaLibrary.createFolder({
				radioId,
				parentId: root.id,
				name: "J-Pop",
			})

			expect(root.parentId).toBeNull()
			expect(child.parentId).toBe(root.id)
			expect(child.kind).toBe("folder")
		}),
	)

	scoped("uploadAudioFile creates an audio node with extracted metadata", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			storageSpy.putObject.mockClear()

			const mediaLibrary = yield* MediaLibraryService
			const uploaded = yield* mediaLibrary.uploadAudioFile({
				radioId,
				parentId: null,
				name: "Intro.wav",
				contentType: "audio/wav",
				content: Stream.make(makeSilentWav(500)),
			})

			expect(uploaded.kind).toBe("audio_file")
			expect(uploaded.name).toBe("Intro.wav")
			expect(uploaded.mimeType).toBe("audio/wav")
			expect(uploaded.durationMs).toBe(180000)
			expect(uploaded.containerFormat).toBe("WAVE")
			expect(uploaded.audioCodec).toBe("PCM")
			expect(uploaded.bitrate).toBe(705600)
			expect(uploaded.title).toBe("Intro Theme")
			expect(uploaded.artist).toBe("Radiant Test Artist")
			expect(uploaded.album).toBe("Radiant Test Album")
			expect(uploaded.albumArtist).toBe("Radiant Test Album Artist")
			expect(uploaded.genre).toBe("Test")
			expect(uploaded.year).toBe(2025)
			expect(uploaded.trackNumber).toBe(1)
			expect(uploaded.trackTotal).toBe(10)
			expect(uploaded.diskNumber).toBe(1)
			expect(uploaded.diskTotal).toBe(1)
			expect(uploaded.coverArtStorageKey).toStartWith(`${radioId}/media_`)
			expect(uploaded.coverArtMimeType).toBe("image/png")
			expect(uploaded.sampleRate).toBe(44100)
			expect(uploaded.channels).toBe(1)
			expect(uploaded.storageKey).toStartWith(`${radioId}/media_`)
			expect(typeof uploaded.fileHash).toBe("string")
			expect(storageSpy.putObject).toHaveBeenCalledTimes(2)
		}),
	)

	scoped("uploadAudioFile rejects files that exceed the user storage quota", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* setUserStorageQuota(BigInt(10))
			storageSpy.putObject.mockClear()
			storageSpy.deleteObject.mockClear()

			const mediaLibrary = yield* MediaLibraryService
			const error = yield* mediaLibrary
				.uploadAudioFile({
					radioId,
					parentId: null,
					name: "Too Large.wav",
					contentType: "audio/wav",
					content: Stream.make(makeSilentWav(500)),
				})
				.pipe(Effect.flip)

			expect(error._tag).toBe("MediaLibraryStorageQuotaExceededError")
			if (error._tag !== "MediaLibraryStorageQuotaExceededError") {
				throw new Error(`Expected MediaLibraryStorageQuotaExceededError, got ${error._tag}`)
			}
			expect(error.quotaBytes).toBe(BigInt(10))
			expect(error.usedBytes).toBe(BigInt(0))
			expect(error.attemptedBytes).toBeGreaterThan(BigInt(10))
			expect(storageSpy.putObject).toHaveBeenCalledTimes(1)
			expect(storageSpy.deleteObject).toHaveBeenCalledTimes(1)
		}),
	)

	scoped("uploadAudioFile accounts for accumulated usage across multiple files", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* setUserStorageQuota(BigInt(60_000))

			const mediaLibrary = yield* MediaLibraryService

			const first = yield* mediaLibrary.uploadAudioFile({
				radioId,
				parentId: null,
				name: "First.wav",
				contentType: "audio/wav",
				content: Stream.make(makeSilentWav(500)),
			})

			const secondError = yield* mediaLibrary
				.uploadAudioFile({
					radioId,
					parentId: null,
					name: "Second.wav",
					contentType: "audio/wav",
					content: Stream.make(makeSilentWav(500)),
				})
				.pipe(Effect.flip)

			expect(first.kind).toBe("audio_file")
			expect(secondError._tag).toBe("MediaLibraryStorageQuotaExceededError")
			if (secondError._tag !== "MediaLibraryStorageQuotaExceededError") {
				throw new Error(`Expected MediaLibraryStorageQuotaExceededError, got ${secondError._tag}`)
			}
			expect(secondError.usedBytes).toBeGreaterThan(BigInt(0))
			expect(secondError.attemptedBytes).toBeGreaterThan(BigInt(0))
			expect(secondError.usedBytes + secondError.attemptedBytes).toBeGreaterThan(
				secondError.quotaBytes,
			)
		}),
	)

	scoped("deleting a file frees storage quota for later uploads", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* setUserStorageQuota(BigInt(60_000))

			const mediaLibrary = yield* MediaLibraryService

			const first = yield* mediaLibrary.uploadAudioFile({
				radioId,
				parentId: null,
				name: "First.wav",
				contentType: "audio/wav",
				content: Stream.make(makeSilentWav(500)),
			})

			const beforeDelete = yield* mediaLibrary
				.uploadAudioFile({
					radioId,
					parentId: null,
					name: "Second.wav",
					contentType: "audio/wav",
					content: Stream.make(makeSilentWav(500)),
				})
				.pipe(Effect.flip)

			expect(beforeDelete._tag).toBe("MediaLibraryStorageQuotaExceededError")

			yield* mediaLibrary.deleteNode({
				radioId,
				nodeId: first.id,
			})

			const second = yield* mediaLibrary.uploadAudioFile({
				radioId,
				parentId: null,
				name: "Second.wav",
				contentType: "audio/wav",
				content: Stream.make(makeSilentWav(500)),
			})

			expect(second.kind).toBe("audio_file")
			expect(second.name).toBe("Second.wav")
		}),
	)

	scoped("createFolder rejects duplicate sibling names", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* seedNode({ id: "media_music", kind: "folder", name: "Music" })

			const mediaLibrary = yield* MediaLibraryService
			const error = yield* mediaLibrary
				.createFolder({
					radioId,
					parentId: null,
					name: "Music",
				})
				.pipe(Effect.flip)

			expect(error._tag).toBe("MediaLibraryNameConflictError")
		}),
	)

	scoped("createFolder rejects non-folder parent", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* seedNode({
				id: "media_track",
				kind: "audio_file",
				name: "Track A.mp3",
			})

			const mediaLibrary = yield* MediaLibraryService
			const error = yield* mediaLibrary
				.createFolder({
					radioId,
					parentId: "media_track",
					name: "Nope",
				})
				.pipe(Effect.flip)

			expect(error._tag).toBe("MediaLibraryInvalidMoveError")
		}),
	)

	scoped("renameNode updates node name", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* seedNode({ id: "media_music", kind: "folder", name: "Music" })

			const mediaLibrary = yield* MediaLibraryService
			const renamed = yield* mediaLibrary.renameNode({
				radioId,
				nodeId: "media_music",
				name: "Library",
			})

			expect(renamed.name).toBe("Library")
		}),
	)

	scoped("moveNode rejects moving folder into descendant", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			yield* seedNode({ id: "media_music", kind: "folder", name: "Music" })
			yield* seedNode({
				id: "media_jpop",
				parentId: "media_music",
				kind: "folder",
				name: "J-Pop",
			})

			const mediaLibrary = yield* MediaLibraryService
			const error = yield* mediaLibrary
				.moveNode({
					radioId,
					nodeId: "media_music",
					parentId: "media_jpop",
				})
				.pipe(Effect.flip)

			expect(error._tag).toBe("MediaLibraryInvalidMoveError")
		}),
	)

	scoped("deleteNode deletes subtree and storage-backed files", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()
			storageSpy.deleteObject.mockClear()
			yield* seedNode({ id: "media_music", kind: "folder", name: "Music" })
			yield* seedNode({
				id: "media_track_a",
				parentId: "media_music",
				kind: "audio_file",
				name: "Track A.mp3",
			})
			yield* seedAudioMetadata({
				mediaNodeId: "media_track_a",
				storageKey: "track-a",
				durationMs: 180000,
				fileHash: "track-a-hash",
			})
			yield* seedNode({
				id: "media_track_b",
				parentId: "media_music",
				kind: "audio_file",
				name: "Track B.mp3",
			})
			yield* seedAudioMetadata({
				mediaNodeId: "media_track_b",
				storageKey: "track-b",
				durationMs: 210000,
				fileHash: "track-b-hash",
			})

			const mediaLibrary = yield* MediaLibraryService
			yield* mediaLibrary.deleteNode({
				radioId,
				nodeId: "media_music",
			})

			const db = yield* Drizzle
			const rows = yield* Effect.promise(() => db.select().from(mediaNodes))
			expect(rows).toHaveLength(0)
			expect(storageSpy.deleteObject).toHaveBeenCalledTimes(2)
			expect(storageSpy.deleteObject).toHaveBeenCalledWith("track-a")
			expect(storageSpy.deleteObject).toHaveBeenCalledWith("track-b")
		}),
	)

	scoped("deleteNode fails when node does not exist", () =>
		Effect.gen(function* () {
			yield* resetDb
			yield* seedRadio()

			const mediaLibrary = yield* MediaLibraryService
			const error = yield* mediaLibrary
				.deleteNode({
					radioId,
					nodeId: "media_missing",
				})
				.pipe(Effect.flip)

			expect(error._tag).toBe("MediaLibraryNodeNotFoundError")
		}),
	)
})
