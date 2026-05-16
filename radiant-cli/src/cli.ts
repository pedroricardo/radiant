import { Command } from "@effect/cli"

import { mediaLibraryCommand } from "./commands/media-library"
import { playoutCommand } from "./commands/playout"

export const rootCommand = Command.make("radiant").pipe(
	Command.withSubcommands([playoutCommand, mediaLibraryCommand]),
)
