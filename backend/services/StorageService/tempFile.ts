import { FileSystem, Path } from "@effect/platform"
import { Effect, Stream } from "effect"
import { StorageService, StorageServiceError } from "./StorageService"

const mapTempFileError = (message: string) => (cause: unknown) =>
	new StorageServiceError({
		message,
		cause,
	})

/**
 * Copies one stored object into a temporary file and returns its local path.
 *
 * The temporary file only lives for the current `Scope`. Once the scope closes,
 * the file and its parent temporary directory are removed automatically.
 */
export const readObjectAsTempFileScoped = (key: string) =>
	Effect.gen(function* () {
		const storage = yield* StorageService
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path

		const tempRoot = process.env.TMPDIR ?? process.env.TMP ?? process.env.TEMP ?? "/tmp"

		const tempDirectory = path.join(tempRoot, `radiant-storage-${crypto.randomUUID()}`)
		const fileName = path.basename(key) || "object.bin"
		const tempPath = path.join(tempDirectory, fileName)

		yield* fs
			.makeDirectory(tempDirectory, { recursive: true })
			.pipe(Effect.mapError(mapTempFileError("failed to create temporary storage directory")))

		yield* Effect.addFinalizer(() =>
			fs
				.remove(tempDirectory, { recursive: true })
				.pipe(
					Effect.mapError(mapTempFileError("failed to clean up temporary storage directory")),
					Effect.ignoreLogged,
				),
		)

		const content = yield* storage.readObject(key)

		yield* Stream.run(content, fs.sink(tempPath)).pipe(
			Effect.mapError((cause) =>
				cause instanceof StorageServiceError
					? cause
					: mapTempFileError("failed to write temporary storage file")(cause),
			),
		)

		return tempPath
	})
