import { Command } from "@effect/cli"

import { uploadAudioFileCommand } from "./upload"

export const mediaLibraryCommand = Command.make("media-library").pipe(
	Command.withSubcommands([uploadAudioFileCommand]),
)
