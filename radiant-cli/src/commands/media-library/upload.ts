import { Command } from "@effect/cli"
import { Effect } from "effect"

import { fetchRadios } from "../../domains/radios/repository"
import { promptRadio } from "../../domains/radios/prompts"
import { promptLocalAudioFile } from "../../domains/local-filesystem/prompts"
import { uploadLocalFileToMediaLibrary } from "../../domains/media-library/destination"

export const uploadAudioFileProgram = Effect.gen(function* () {
	const radios = yield* fetchRadios

	if (radios.length === 0) {
		yield* Effect.logWarning("No radios were found in the database.")
		return
	}

	const radio = yield* promptRadio(radios)
	const selectedFile = yield* promptLocalAudioFile()

	const uploaded = yield* uploadLocalFileToMediaLibrary({
		radioId: radio.id,
		fileName: selectedFile.name,
		contentType: selectedFile.metadata.mimeType ?? undefined,
		filePath: selectedFile.path,
	})

	yield* Effect.logInfo(`Uploaded ${uploaded.name} to radio ${radio.name}.`)
})

export const uploadAudioFileCommand = Command.make("upload", {}, () => uploadAudioFileProgram)
