import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

import type { Radio } from "@radiant/client/lib"
import { MediaLibraryService } from "@radiant/backend/services/MediaLibraryService"
import type { MediaNode } from "@radiant/client/lib/MediaNode"
import * as Prompter from "../../shared/Prompter"

export interface MediaLibraryDestination {
	readonly parentId: MediaNode["id"] | null
	readonly fileName: string
}

const splitDestinationPath = (value: string): ReadonlyArray<string> =>
	value
		.trim()
		.split(/[\\/]/g)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0)

const validateDestinationPath = (value: string | undefined) => {
	const segments = splitDestinationPath(value ?? "")

	if (segments.length === 0) {
		return "Provide a file path inside the media library."
	}

	if (segments.some((segment) => segment === "." || segment === "..")) {
		return "Use normal folder and file names only."
	}

	if (segments.some((segment) => segment.length > 255)) {
		return "Each path segment must be at most 255 characters."
	}

	return undefined
}

const ensureFolderPath = (radioId: Radio.RadioId, folderSegments: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const mediaLibrary = yield* MediaLibraryService
		let parentId: MediaNode["id"] | null = null
		let children = yield* mediaLibrary.getTree(radioId)

		for (const segment of folderSegments) {
			const existing = children.find((node) => node.kind === "folder" && node.name === segment)
			if (existing != null) {
				parentId = existing.id
				children = existing.children
				continue
			}

			const created: MediaNode = yield* mediaLibrary.createFolder({
				radioId,
				parentId,
				name: segment,
			})
			parentId = created.id
			children = []
		}

		return parentId
	})

export const promptMediaLibraryDestination = (defaultFileName: string) =>
	Effect.gen(function* () {
		const prompter = yield* Prompter.Prompter
		const destinationPath = yield* prompter.text({
			message: "Where should this file be stored inside the media library?",
			placeholder: `Music/${defaultFileName}`,
			initialValue: defaultFileName,
			validate: validateDestinationPath,
		})

		const segments = splitDestinationPath(destinationPath)

		return {
			folderSegments: segments.slice(0, -1),
			fileName: segments[segments.length - 1]!,
		} as const
	})

export const uploadLocalFileToMediaLibrary = (args: {
	readonly radioId: Radio.RadioId
	readonly fileName: string
	readonly contentType?: string | undefined
	readonly filePath: string
}) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const mediaLibrary = yield* MediaLibraryService
		const destination = yield* promptMediaLibraryDestination(args.fileName)
		const parentId = yield* ensureFolderPath(args.radioId, destination.folderSegments)

		return yield* mediaLibrary.uploadAudioFile({
			radioId: args.radioId,
			parentId,
			name: destination.fileName,
			contentType: args.contentType,
			content: fs.stream(args.filePath),
		})
	})
