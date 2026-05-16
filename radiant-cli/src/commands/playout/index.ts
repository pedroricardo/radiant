import { Command } from "@effect/cli"

import { addBlockCommand } from "./addBlock"

export const playoutCommand = Command.make("playout").pipe(
	Command.withSubcommands([addBlockCommand]),
)
