import { FileSystem, Path } from "@effect/platform"
import { Effect } from "effect"

import type { ExtractedAudioMetadata } from "@radiant/backend/services/MetadataExtractionService"
import { MetadataExtractionService } from "@radiant/backend/services/MetadataExtractionService"
import * as Prompter from "../../shared/Prompter"
import {
	InvalidLocalAudioFileError,
	ReadLocalDirectoryError,
	ReadLocalFileInfoError,
} from "./errors"

interface DirectoryChoice {
	readonly kind: "directory" | "parent" | "file"
	readonly path: string
}

export interface SelectedLocalAudioFile {
	readonly path: string
	readonly name: string
	readonly metadata: ExtractedAudioMetadata
}

const formatDuration = (durationMs: number) => {
	const totalSeconds = Math.floor(durationMs / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${String(seconds).padStart(2, "0")}`
}

const inspectLocalAudioFile = (filePath: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const metadataExtraction = yield* MetadataExtractionService

		return yield* metadataExtraction
			.extractAudioMetadata({
				name: path.basename(filePath),
				content: fs.stream(filePath),
			})
			.pipe(
				Effect.catchTags({
					InvalidAudioFileError: (error) =>
						Effect.fail(
							new InvalidLocalAudioFileError({
								path: filePath,
								message: error.message,
							}),
						),
					MetadataExtractionError: (cause) =>
						Effect.fail(
							new InvalidLocalAudioFileError({
								path: filePath,
								message: "Could not read audio metadata from the selected file.",
								cause,
							}),
						),
				}),
			)
	})

const logMetadataPreview = (selection: SelectedLocalAudioFile) =>
	Effect.logInfo([
		`Selected local file: ${selection.name}`,
		`Duration: ${formatDuration(selection.metadata.durationMs)}`,
		`Codec: ${selection.metadata.audioCodec ?? "-"}`,
		`Container: ${selection.metadata.containerFormat ?? "-"}`,
		`Title: ${selection.metadata.title ?? "-"}`,
		`Artist: ${selection.metadata.artist ?? "-"}`,
		`Album: ${selection.metadata.album ?? "-"}`,
		`Sample rate: ${selection.metadata.sampleRate != null ? `${selection.metadata.sampleRate} Hz` : "-"}`,
		`Channels: ${selection.metadata.channels ?? "-"}`,
		`Cover art: ${selection.metadata.coverArt != null ? "yes" : "no"}`,
	])

const listDirectoryChoices = (directoryPath: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path

		const names = yield* fs.readDirectory(directoryPath).pipe(
			Effect.mapError(
				(cause) =>
					new ReadLocalDirectoryError({
						path: directoryPath,
						cause,
					}),
			),
		)

		const entries = yield* Effect.forEach(names, (name) =>
			Effect.gen(function* () {
				const fullPath = path.join(directoryPath, name)
				const info = yield* fs.stat(fullPath).pipe(
					Effect.mapError(
						(cause) =>
							new ReadLocalFileInfoError({
								path: fullPath,
								cause,
							}),
					),
				)

				return {
					name,
					path: fullPath,
					type: info.type,
				} as const
			}),
		)

		const directories = entries
			.filter((entry) => entry.type === "Directory")
			.sort((a, b) => a.name.localeCompare(b.name))
		const files = entries
			.filter((entry) => entry.type === "File")
			.sort((a, b) => a.name.localeCompare(b.name))

		return { directories, files } as const
	})

const browseDirectory = (
	directoryPath: string,
): Effect.Effect<
	SelectedLocalAudioFile,
	| ReadLocalDirectoryError
	| ReadLocalFileInfoError
	| Prompter.PromptCanceledError
	| Prompter.PromptExecutionError,
	Prompter.Prompter | FileSystem.FileSystem | Path.Path | MetadataExtractionService
> =>
	Effect.gen(function* () {
		const prompter = yield* Prompter.Prompter
		const path = yield* Path.Path
		const { directories, files } = yield* listDirectoryChoices(directoryPath)

		const currentDirLabel = path.basename(directoryPath) || directoryPath
		const canGoParent = path.dirname(directoryPath) !== directoryPath
		const options = [
			...(canGoParent
				? [
						{
							value: { kind: "parent", path: path.dirname(directoryPath) } as DirectoryChoice,
							label: "..",
							hint: "Go to parent directory",
						},
					]
				: []),
			...directories.map((entry) => ({
				value: { kind: "directory", path: entry.path } as DirectoryChoice,
				label: `${entry.name}/`,
				hint: "Directory",
			})),
			...files.map((entry) => ({
				value: { kind: "file", path: entry.path } as DirectoryChoice,
				label: entry.name,
				hint: "File",
			})),
		]

		const choice = yield* prompter.select<DirectoryChoice>({
			message: `Choose a local file from ${currentDirLabel}`,
			options,
		})

		if (choice.kind === "parent" || choice.kind === "directory") {
			return yield* browseDirectory(choice.path)
		}

		const selection = yield* inspectLocalAudioFile(choice.path).pipe(
			Effect.map((metadata) => ({
				path: choice.path,
				name: path.basename(choice.path),
				metadata,
			})),
			Effect.catchTag("InvalidLocalAudioFileError", (error) =>
				Effect.logWarning(error.message).pipe(Effect.zipRight(browseDirectory(directoryPath))),
			),
		)

		yield* logMetadataPreview(selection)
		return selection
	})

export const promptLocalAudioFile = (startDirectory: string = process.cwd()) =>
	Effect.gen(function* () {
		const path = yield* Path.Path
		return yield* browseDirectory(path.resolve(startDirectory))
	})
