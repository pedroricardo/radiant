import { FileSystem, Path } from "@effect/platform"
import { Config, Context, Data, Effect, Layer, Stream } from "effect"

export class StorageServiceError extends Data.TaggedError("StorageServiceError")<{
	message: string
	cause: unknown
}> {}

const mapStorageError = (message: string) => (cause: unknown) =>
	new StorageServiceError({
		message,
		cause,
	})

const toStoragePath = (root: string, key: string, path: Path.Path) =>
	path.join(root, ...key.split("/").filter((segment) => segment.length > 0))

export class StorageService extends Context.Tag("StorageService")<
	StorageService,
	{
		readonly putObject: <E>(args: {
			readonly radioId: string
			readonly key: string
			readonly contentType?: string | undefined
			readonly content: Stream.Stream<Uint8Array, E>
		}) => Effect.Effect<void, StorageServiceError | E>
		readonly readObject: (
			key: string,
		) => Effect.Effect<Stream.Stream<Uint8Array, StorageServiceError>, StorageServiceError>
		readonly moveObject: (args: {
			readonly fromKey: string
			readonly toKey: string
		}) => Effect.Effect<void, StorageServiceError>
		readonly deleteObject: (key: string) => Effect.Effect<void, StorageServiceError>
	}
>() {}

export const UnimplementedStorageService: Layer.Layer<StorageService> = Layer.succeed(
	StorageService,
	{
		putObject: (_args) => Effect.dieMessage("StorageService.putObject not implemented"),
		readObject: (_key) => Effect.dieMessage("StorageService.readObject not implemented"),
		moveObject: (_args) => Effect.dieMessage("StorageService.moveObject not implemented"),
		deleteObject: (_key) => Effect.dieMessage("StorageService.deleteObject not implemented"),
	},
)

export const LocalDiskStorageService = Layer.effect(
	StorageService,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const root = yield* Config.string("RADIANT_STORAGE_ROOT").pipe(
			Config.withDefault(import.meta.dirname + "/.radiant-storage"),
		)

		const ensureParentDirectory = (key: string) =>
			fs
				.makeDirectory(path.dirname(toStoragePath(root, key, path)), { recursive: true })
				.pipe(Effect.mapError(mapStorageError("failed to create storage directory")))

		const removeIfExists = (targetPath: string) =>
			fs.exists(targetPath).pipe(
				Effect.mapError(mapStorageError("failed to check storage path existence")),
				Effect.flatMap((exists) =>
					exists
						? fs
								.remove(targetPath, { recursive: true })
								.pipe(Effect.mapError(mapStorageError("failed to cleanup storage path")))
						: Effect.void,
				),
			)

		return {
			putObject: ({ key, content }) =>
				Effect.gen(function* () {
					const targetPath = toStoragePath(root, key, path)
					const tempPath = `${targetPath}.part`
					yield* ensureParentDirectory(key)
					yield* removeIfExists(tempPath)
					yield* Stream.run(content, fs.sink(tempPath)).pipe(
						Effect.mapError(mapStorageError("failed to write object to storage")),
						Effect.tapError(() => removeIfExists(tempPath).pipe(Effect.ignoreLogged)),
					)
					yield* removeIfExists(targetPath)
					yield* fs.rename(tempPath, targetPath).pipe(
						Effect.mapError(mapStorageError("failed to finalize stored object")),
						Effect.tapError(() => removeIfExists(tempPath).pipe(Effect.ignoreLogged)),
					)
				}),

			readObject: (key) =>
				Effect.sync(() =>
					fs
						.stream(toStoragePath(root, key, path))
						.pipe(Stream.mapError(mapStorageError("failed to read object from storage"))),
				).pipe(Effect.mapError(mapStorageError("failed to prepare storage read stream"))),

			moveObject: ({ fromKey, toKey }) =>
				Effect.gen(function* () {
					yield* ensureParentDirectory(toKey)
					yield* fs
						.rename(toStoragePath(root, fromKey, path), toStoragePath(root, toKey, path))
						.pipe(Effect.mapError(mapStorageError("failed to move stored object")))
				}),

			deleteObject: (key) =>
				removeIfExists(toStoragePath(root, key, path)).pipe(
					Effect.mapError(mapStorageError("failed to delete stored object")),
				),
		}
	}),
)
