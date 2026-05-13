import { and, asc, eq, isNull, ne } from "drizzle-orm"
import { Context, Data, DateTime, Effect, Layer, Stream } from "effect"
import { createHash } from "node:crypto"

import { Id, MediaLibrary, MediaNode, Radio } from "../../lib"
import { Drizzle } from "../Drizzle"
import { mediaNodeAudioMetadata } from "../Drizzle/schema/mediaNodeAudioMetadata"
import { mediaNodes } from "../Drizzle/schema/mediaNodes"
import { MetadataExtractionService } from "../MetadataExtractionService"
import { StorageService, StorageServiceError } from "../StorageService"

type DbMediaNode = typeof mediaNodes.$inferSelect
type DbMediaNodeAudioMetadata = typeof mediaNodeAudioMetadata.$inferSelect
type DbMediaNodeRow = {
	readonly media_nodes: DbMediaNode
	readonly media_node_audio_metadata: DbMediaNodeAudioMetadata | null
}

export class MediaLibraryServiceError extends Data.TaggedError("MediaLibraryServiceError")<{
	cause: unknown
	message: string
}> {}

export class MediaLibraryNodeNotFoundError extends Data.TaggedError("MediaLibraryNodeNotFoundError")<{
	radioId: Radio.RadioId
	nodeId: MediaNode.MediaNodeId
}> {}

export class MediaLibraryNameConflictError extends Data.TaggedError("MediaLibraryNameConflictError")<{
	name: string
}> {}

export class MediaLibraryInvalidMoveError extends Data.TaggedError("MediaLibraryInvalidMoveError")<{
	message: string
}> {}

export class MediaLibraryInvalidAudioFileError extends Data.TaggedError(
	"MediaLibraryInvalidAudioFileError",
)<{
	message: string
}> {}

export class MediaLibraryCoverArtNotFoundError extends Data.TaggedError(
	"MediaLibraryCoverArtNotFoundError",
)<{
	radioId: Radio.RadioId
	nodeId: MediaNode.MediaNodeId
}> {}

const staticTree: ReadonlyArray<MediaLibrary.MediaLibraryTreeNode> = [
	{
		id: "media_root_music",
		name: "Music",
		kind: "folder",
		children: [
			{
				id: "media_jpop_folder",
				name: "J-Pop",
				kind: "folder",
				children: [
					{
						id: "media_matsuri_file",
						name: "Fujii Kaze - Matsuri.m4a",
						kind: "audio_file",
						children: [],
					},
					{
						id: "media_lamp_file",
						name: "Lamp - Koibito e.flac",
						kind: "audio_file",
						children: [],
					},
				],
			},
		],
	},
]

const toMediaLibraryTree = (
	nodes: ReadonlyArray<DbMediaNodeRow>,
	parentId: MediaNode.MediaNodeId | null,
): ReadonlyArray<MediaLibrary.MediaLibraryTreeNode> =>
	nodes
		.filter((row) =>
			parentId === null
				? row.media_nodes.parentId == null
				: row.media_nodes.parentId === parentId,
		)
		.map((node) => ({
			id: node.media_nodes.id,
			name: node.media_nodes.name,
			kind: node.media_nodes.kind,
			children: toMediaLibraryTree(nodes, node.media_nodes.id),
		}))

const toMediaNode = (
	node: DbMediaNode,
	audioMetadata: DbMediaNodeAudioMetadata | null,
): MediaNode.MediaNode =>
	MediaNode.MediaNode.make({
		id: node.id,
		radioId: node.radioId,
		parentId: node.parentId ?? null,
		kind: node.kind,
		name: node.name,
		storageKey: audioMetadata?.storageKey ?? null,
		mimeType: audioMetadata?.mimeType ?? null,
		sizeBytes: audioMetadata?.sizeBytes ?? null,
		durationMs: audioMetadata?.durationMs ?? null,
		containerFormat: audioMetadata?.containerFormat ?? null,
		audioCodec: audioMetadata?.audioCodec ?? null,
		bitrate: audioMetadata?.bitrate ?? null,
		title: audioMetadata?.title ?? null,
		artist: audioMetadata?.artist ?? null,
		album: audioMetadata?.album ?? null,
		albumArtist: audioMetadata?.albumArtist ?? null,
		genre: audioMetadata?.genre ?? null,
		year: audioMetadata?.year ?? null,
		trackNumber: audioMetadata?.trackNumber ?? null,
		trackTotal: audioMetadata?.trackTotal ?? null,
		diskNumber: audioMetadata?.diskNumber ?? null,
		diskTotal: audioMetadata?.diskTotal ?? null,
		coverArtStorageKey: audioMetadata?.coverArtStorageKey ?? null,
		coverArtMimeType: audioMetadata?.coverArtMimeType ?? null,
		sampleRate: audioMetadata?.sampleRate ?? null,
		channels: audioMetadata?.channels ?? null,
		fileHash: audioMetadata?.fileHash ?? null,
		createdAt: DateTime.unsafeFromDate(node.createdAt),
		updatedAt: DateTime.unsafeFromDate(node.updatedAt),
	})

const isUniqueViolation = (cause: unknown) =>
	typeof cause === "object" &&
	cause !== null &&
	"code" in cause &&
	(cause as { code?: string }).code === "23505"

const streamToServiceError = (cause: unknown) =>
	new MediaLibraryServiceError({
		cause,
		message: "failed to process media file stream",
	})

export class MediaLibraryService extends Context.Tag("MediaLibraryService")<
	MediaLibraryService,
	{
		readonly getTree: (
			radioId: Radio.RadioId,
		) => Effect.Effect<ReadonlyArray<MediaLibrary.MediaLibraryTreeNode>, MediaLibraryServiceError>
		readonly uploadAudioFile: (args: {
			readonly radioId: Radio.RadioId
			readonly parentId: MediaNode.MediaNodeId | null
			readonly name: string
			readonly contentType?: string | undefined
			readonly content: Stream.Stream<Uint8Array, unknown>
		}) => Effect.Effect<
			MediaNode.MediaNode,
			| MediaLibraryServiceError
			| MediaLibraryNodeNotFoundError
			| MediaLibraryNameConflictError
			| MediaLibraryInvalidMoveError
			| MediaLibraryInvalidAudioFileError
		>
		readonly getCoverArt: (args: {
			readonly radioId: Radio.RadioId
			readonly nodeId: MediaNode.MediaNodeId
		}) => Effect.Effect<
			{
				readonly contentType: string
				readonly content: Stream.Stream<Uint8Array, StorageServiceError>
			},
			| MediaLibraryServiceError
			| MediaLibraryNodeNotFoundError
			| MediaLibraryCoverArtNotFoundError
		>
		readonly createFolder: (args: {
			radioId: Radio.RadioId
			parentId: MediaNode.MediaNodeId | null
			name: string
		}) => Effect.Effect<
			MediaNode.MediaNode,
			| MediaLibraryServiceError
			| MediaLibraryNodeNotFoundError
			| MediaLibraryNameConflictError
			| MediaLibraryInvalidMoveError
		>
		readonly renameNode: (args: {
			radioId: Radio.RadioId
			nodeId: MediaNode.MediaNodeId
			name: string
		}) => Effect.Effect<
			MediaNode.MediaNode,
			| MediaLibraryServiceError
			| MediaLibraryNodeNotFoundError
			| MediaLibraryNameConflictError
		>
		readonly moveNode: (args: {
			radioId: Radio.RadioId
			nodeId: MediaNode.MediaNodeId
			parentId: MediaNode.MediaNodeId | null
		}) => Effect.Effect<
			MediaNode.MediaNode,
			| MediaLibraryServiceError
			| MediaLibraryNodeNotFoundError
			| MediaLibraryNameConflictError
			| MediaLibraryInvalidMoveError
		>
		readonly deleteNode: (args: {
			radioId: Radio.RadioId
			nodeId: MediaNode.MediaNodeId
		}) => Effect.Effect<void, MediaLibraryServiceError | MediaLibraryNodeNotFoundError>
	}
>() {}

export const MockStaticMediaLibraryService: Layer.Layer<MediaLibraryService> = Layer.succeed(
	MediaLibraryService,
	{
		getTree: (_radioId) => Effect.succeed(staticTree),
		uploadAudioFile: () => Effect.dieMessage("MockStaticMediaLibraryService.uploadAudioFile not implemented"),
		getCoverArt: () => Effect.dieMessage("MockStaticMediaLibraryService.getCoverArt not implemented"),
		createFolder: () => Effect.dieMessage("MockStaticMediaLibraryService.createFolder not implemented"),
		renameNode: () => Effect.dieMessage("MockStaticMediaLibraryService.renameNode not implemented"),
		moveNode: () => Effect.dieMessage("MockStaticMediaLibraryService.moveNode not implemented"),
		deleteNode: () => Effect.dieMessage("MockStaticMediaLibraryService.deleteNode not implemented"),
	},
)

export const DatabaseMediaLibraryService: Layer.Layer<
	MediaLibraryService,
	never,
	Drizzle | StorageService | MetadataExtractionService
> = Layer.effect(
	MediaLibraryService,
	Effect.gen(function* () {
		const db = yield* Drizzle
		const storage = yield* StorageService
		const metadataExtraction = yield* MetadataExtractionService

		const getAllNodes = (radioId: Radio.RadioId) =>
			Effect.tryPromise({
				try: () =>
					db
						.select()
						.from(mediaNodes)
						.leftJoin(
							mediaNodeAudioMetadata,
							eq(mediaNodeAudioMetadata.mediaNodeId, mediaNodes.id),
						)
						.where(eq(mediaNodes.radioId, radioId))
						.orderBy(asc(mediaNodes.parentId), asc(mediaNodes.name)),
				catch: (cause) =>
					new MediaLibraryServiceError({
						cause,
						message: "failed to query media nodes",
					}),
			})

		const getNodeOrFail = (radioId: Radio.RadioId, nodeId: MediaNode.MediaNodeId) =>
			Effect.gen(function* () {
				const rows = yield* Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(mediaNodes)
							.where(and(eq(mediaNodes.radioId, radioId), eq(mediaNodes.id, nodeId))),
					catch: (cause) =>
						new MediaLibraryServiceError({
							cause,
							message: "failed to query media node",
						}),
				})
				const row = rows[0]
				if (!row) {
					return yield* new MediaLibraryNodeNotFoundError({ radioId, nodeId })
				}
				return row
			})

		const getNodeRowOrFail = (radioId: Radio.RadioId, nodeId: MediaNode.MediaNodeId) =>
			Effect.gen(function* () {
				const rows = yield* Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(mediaNodes)
							.leftJoin(
								mediaNodeAudioMetadata,
								eq(mediaNodeAudioMetadata.mediaNodeId, mediaNodes.id),
							)
							.where(and(eq(mediaNodes.radioId, radioId), eq(mediaNodes.id, nodeId))),
					catch: (cause) =>
						new MediaLibraryServiceError({
							cause,
							message: "failed to query media node row",
						}),
				})
				const row = rows[0]
				if (!row) {
					return yield* new MediaLibraryNodeNotFoundError({ radioId, nodeId })
				}
				return row
			})

		const ensureParentFolder = (
			radioId: Radio.RadioId,
			parentId: MediaNode.MediaNodeId | null,
		): Effect.Effect<void, MediaLibraryServiceError | MediaLibraryNodeNotFoundError | MediaLibraryInvalidMoveError> =>
			Effect.gen(function* () {
				if (parentId == null) return
				const parent = yield* getNodeOrFail(radioId, parentId)
				if (parent.kind !== "folder") {
					return yield* new MediaLibraryInvalidMoveError({
						message: "parent must be a folder",
					})
				}
			})

		const ensureSiblingNameAvailable = (args: {
			radioId: Radio.RadioId
			parentId: MediaNode.MediaNodeId | null
			name: string
			excludeNodeId?: MediaNode.MediaNodeId | undefined
		}) =>
			Effect.gen(function* () {
				const conditions = [
					eq(mediaNodes.radioId, args.radioId),
					eq(mediaNodes.name, args.name),
					args.parentId == null ? isNull(mediaNodes.parentId) : eq(mediaNodes.parentId, args.parentId),
					args.excludeNodeId ? ne(mediaNodes.id, args.excludeNodeId) : undefined,
				]

				const rows = yield* Effect.tryPromise({
					try: () => db.select({ id: mediaNodes.id }).from(mediaNodes).where(and(...conditions)),
					catch: (cause) =>
						new MediaLibraryServiceError({
							cause,
							message: "failed to check sibling name availability",
						}),
				})
				if (rows.length > 0) {
					return yield* new MediaLibraryNameConflictError({ name: args.name })
				}
			})

		return {
			getTree: (radioId: Radio.RadioId) =>
				Effect.gen(function* () {
					const rows = yield* getAllNodes(radioId)
					return toMediaLibraryTree(rows, null)
				}).pipe(
					Effect.annotateLogs({ radioId }),
					Effect.withSpan("MediaLibraryService.getTree", { attributes: { radioId } }),
				),

			uploadAudioFile: ({ radioId, parentId, name, contentType, content }) =>
				Effect.scoped(
					Effect.gen(function* () {
						yield* ensureParentFolder(radioId, parentId)
						yield* ensureSiblingNameAvailable({ radioId, parentId, name })

						const nodeId = Id.random(MediaNode.idPrefix) satisfies MediaNode.MediaNodeId
						const storageKey = `${radioId}/${nodeId}`
						const [storageContentBase, metadataContentBase] = yield* content.pipe(
							Stream.broadcast(2, 16),
						)
						const hash = createHash("sha256")
						let sizeBytes = BigInt(0)
						let coverArtStorageKey: string | null = null

						const storageContent = storageContentBase.pipe(
							Stream.mapError(streamToServiceError),
							Stream.tap((chunk) =>
								Effect.sync(() => {
									hash.update(chunk)
									sizeBytes += BigInt(chunk.byteLength)
								}),
							),
						)

						const metadataContent = metadataContentBase.pipe(Stream.mapError(streamToServiceError))

						const extracted = yield* Effect.all(
							{
								_: storage
									.putObject({
										radioId,
										key: storageKey,
										contentType,
										content: storageContent,
									})
									.pipe(
										Effect.catchTag(
											"StorageServiceError",
											(cause) =>
												Effect.fail(
													new MediaLibraryServiceError({
														cause,
														message: "failed to store the uploaded audio file",
													}),
												),
										),
									),
								metadata: metadataExtraction
									.extractAudioMetadata({
										name,
										contentType,
										content: metadataContent,
									})
									.pipe(
										Effect.timeoutFail({
											duration: "5 seconds",
											onTimeout: () =>
												new MediaLibraryInvalidAudioFileError({
													message: "metadata extraction timed out after 5s",
												}),
										}),
										Effect.catchTag(
											"InvalidAudioFileError",
											(error) =>
												Effect.fail(
													new MediaLibraryInvalidAudioFileError({
														message: error.message,
													}),
												),
										),
										Effect.catchTag(
											"MetadataExtractionError",
											(cause) =>
												Effect.fail(
													new MediaLibraryServiceError({
														cause,
														message: "failed to extract metadata from the uploaded audio file",
													}),
												),
										),
									),
							},
							{ concurrency: "unbounded" },
						).pipe(
							Effect.map(({ metadata }) => metadata),
							Effect.tapError(() => storage.deleteObject(storageKey).pipe(Effect.ignoreLogged)),
						)

						if (extracted.coverArt != null) {
							coverArtStorageKey = `${storageKey}/cover`
							yield* storage
								.putObject({
									radioId,
									key: coverArtStorageKey,
									contentType: extracted.coverArt.mimeType ?? undefined,
									content: Stream.make(extracted.coverArt.data),
								})
								.pipe(
									Effect.catchTag(
										"StorageServiceError",
										(cause) =>
											Effect.fail(
												new MediaLibraryServiceError({
													cause,
													message: "failed to store extracted cover art",
												}),
											),
									),
									Effect.tapError(() =>
										storage.deleteObject(storageKey).pipe(Effect.ignoreLogged),
									),
								)
						}

						const now = yield* DateTime.nowAsDate
						const fileHash = hash.digest("hex")
						const nodeRows = yield* Effect.tryPromise({
							try: () =>
								db
									.insert(mediaNodes)
									.values({
										id: nodeId,
										radioId,
										parentId,
										kind: "audio_file",
										name,
										createdAt: now,
										updatedAt: now,
									})
									.returning(),
							catch: (cause) =>
								isUniqueViolation(cause)
									? new MediaLibraryNameConflictError({ name })
									: new MediaLibraryServiceError({
											cause,
											message: "failed to create media library file node",
										}),
						}).pipe(
							Effect.tapError(() =>
								Effect.all([
									storage.deleteObject(storageKey).pipe(Effect.ignoreLogged),
									coverArtStorageKey != null
										? storage.deleteObject(coverArtStorageKey).pipe(Effect.ignoreLogged)
										: Effect.void,
									]),
							),
						)

						const metadataRows = yield* Effect.tryPromise({
							try: () =>
								db
									.insert(mediaNodeAudioMetadata)
									.values({
										mediaNodeId: nodeId,
										storageKey,
										mimeType: extracted.mimeType,
										sizeBytes,
										durationMs: extracted.durationMs,
										containerFormat: extracted.containerFormat,
										audioCodec: extracted.audioCodec,
										bitrate: extracted.bitrate,
										title: extracted.title,
										artist: extracted.artist,
										album: extracted.album,
										albumArtist: extracted.albumArtist,
										genre: extracted.genre,
										year: extracted.year,
										trackNumber: extracted.trackNumber,
										trackTotal: extracted.trackTotal,
										diskNumber: extracted.diskNumber,
										diskTotal: extracted.diskTotal,
										coverArtStorageKey,
										coverArtMimeType: extracted.coverArt?.mimeType ?? null,
										sampleRate: extracted.sampleRate,
										channels: extracted.channels,
										fileHash,
									})
									.returning(),
							catch: (cause) =>
								new MediaLibraryServiceError({
									cause,
									message: "failed to create media library file metadata",
								}),
						}).pipe(
							Effect.tapError(() =>
								Effect.all([
									Effect.tryPromise({
										try: () => db.delete(mediaNodes).where(eq(mediaNodes.id, nodeId)),
										catch: () => undefined,
									}).pipe(Effect.ignoreLogged),
									storage.deleteObject(storageKey).pipe(Effect.ignoreLogged),
									coverArtStorageKey != null
										? storage.deleteObject(coverArtStorageKey).pipe(Effect.ignoreLogged)
										: Effect.void,
								]),
							),
						)

						return toMediaNode(nodeRows[0]!, metadataRows[0]!)
					}),
				),

			getCoverArt: ({ radioId, nodeId }) =>
				Effect.gen(function* () {
					const row = yield* getNodeRowOrFail(radioId, nodeId)
					const coverArtStorageKey = row.media_node_audio_metadata?.coverArtStorageKey
					if (coverArtStorageKey == null) {
						return yield* new MediaLibraryCoverArtNotFoundError({ radioId, nodeId })
					}

					return {
						contentType:
							row.media_node_audio_metadata?.coverArtMimeType ?? "application/octet-stream",
						content: yield* storage.readObject(coverArtStorageKey).pipe(
							Effect.mapError(
								(cause) =>
									new MediaLibraryServiceError({
										cause,
										message: "failed to read stored cover art",
									}),
							),
						),
					} as const
				}),

			createFolder: ({ radioId, parentId, name }) =>
				Effect.gen(function* () {
					yield* ensureParentFolder(radioId, parentId)
					yield* ensureSiblingNameAvailable({ radioId, parentId, name })
					const updatedAt = yield* DateTime.nowAsDate
					const createdAt = updatedAt
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.insert(mediaNodes)
								.values({
									radioId,
									parentId,
									kind: "folder",
									name,
									createdAt,
									updatedAt,
								})
								.returning(),
						catch: (cause) =>
							isUniqueViolation(cause)
								? new MediaLibraryNameConflictError({ name })
								: new MediaLibraryServiceError({
										cause,
										message: "failed to create folder",
									}),
					})
					return toMediaNode(rows[0]!, null)
				}),

			renameNode: ({ radioId, nodeId, name }) =>
				Effect.gen(function* () {
					const node = yield* getNodeOrFail(radioId, nodeId)
					yield* ensureSiblingNameAvailable({
						radioId,
						parentId: node.parentId ?? null,
						name,
						excludeNodeId: node.id,
					})
					const updatedAt = yield* DateTime.nowAsDate
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.update(mediaNodes)
								.set({ name, updatedAt })
								.where(and(eq(mediaNodes.radioId, radioId), eq(mediaNodes.id, node.id)))
								.returning(),
						catch: (cause) =>
							isUniqueViolation(cause)
								? new MediaLibraryNameConflictError({ name })
								: new MediaLibraryServiceError({
										cause,
										message: "failed to rename media node",
									}),
					})
					const row = yield* getNodeRowOrFail(radioId, rows[0]!.id)
					return toMediaNode(row.media_nodes, row.media_node_audio_metadata)
				}),

			moveNode: ({ radioId, nodeId, parentId }) =>
				Effect.gen(function* () {
					const allNodes = yield* getAllNodes(radioId)
					const node = allNodes.find((candidate) => candidate.media_nodes.id === nodeId)?.media_nodes
					if (!node) {
						return yield* new MediaLibraryNodeNotFoundError({ radioId, nodeId })
					}

					yield* ensureParentFolder(radioId, parentId)
					yield* ensureSiblingNameAvailable({
						radioId,
						parentId,
						name: node.name,
						excludeNodeId: node.id,
					})

					if (parentId === nodeId) {
						return yield* new MediaLibraryInvalidMoveError({
							message: "a node cannot be moved into itself",
						})
					}

					let cursor = parentId
					while (cursor != null) {
						if (cursor === nodeId) {
							return yield* new MediaLibraryInvalidMoveError({
								message: "a node cannot be moved into one of its descendants",
							})
						}
						cursor =
							allNodes.find((candidate) => candidate.media_nodes.id === cursor)?.media_nodes.parentId ??
							null
					}

					const updatedAt = yield* DateTime.nowAsDate
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.update(mediaNodes)
								.set({ parentId, updatedAt })
								.where(and(eq(mediaNodes.radioId, radioId), eq(mediaNodes.id, nodeId)))
								.returning(),
						catch: (cause) =>
							isUniqueViolation(cause)
								? new MediaLibraryNameConflictError({ name: node.name })
								: new MediaLibraryServiceError({
										cause,
										message: "failed to move media node",
									}),
					})
					const row = yield* getNodeRowOrFail(radioId, rows[0]!.id)
					return toMediaNode(row.media_nodes, row.media_node_audio_metadata)
				}),

			deleteNode: ({ radioId, nodeId }) =>
				Effect.gen(function* () {
					const allNodes = yield* getAllNodes(radioId)
					const node = allNodes.find((candidate) => candidate.media_nodes.id === nodeId)?.media_nodes
					if (!node) {
						return yield* new MediaLibraryNodeNotFoundError({ radioId, nodeId })
					}

					const descendants = new Set<MediaNode.MediaNodeId>([nodeId])
					let changed = true
					while (changed) {
						changed = false
						for (const candidate of allNodes) {
							if (
								candidate.media_nodes.parentId != null &&
								descendants.has(candidate.media_nodes.parentId) &&
								!descendants.has(candidate.media_nodes.id)
							) {
								descendants.add(candidate.media_nodes.id)
								changed = true
							}
						}
					}

					for (const candidate of allNodes) {
						if (descendants.has(candidate.media_nodes.id)) {
							if (candidate.media_node_audio_metadata?.storageKey != null) {
								yield* storage.deleteObject(candidate.media_node_audio_metadata.storageKey).pipe(
									Effect.mapError((cause) =>
										new MediaLibraryServiceError({
											cause,
											message: "failed to delete stored object while deleting media node",
										}),
									),
								)
							}
							if (candidate.media_node_audio_metadata?.coverArtStorageKey != null) {
								yield* storage.deleteObject(
									candidate.media_node_audio_metadata.coverArtStorageKey,
								).pipe(
									Effect.mapError((cause) =>
										new MediaLibraryServiceError({
											cause,
											message: "failed to delete stored cover art while deleting media node",
										}),
									),
								)
							}
						}
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.delete(mediaNodes)
								.where(and(eq(mediaNodes.radioId, radioId), eq(mediaNodes.id, nodeId))),
						catch: (cause) =>
							new MediaLibraryServiceError({
								cause,
								message: "failed to delete media node",
							}),
					})
				}),
		}
	}),
)
