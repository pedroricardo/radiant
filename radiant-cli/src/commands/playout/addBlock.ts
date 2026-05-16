import { Command } from "@effect/cli"
import { Effect } from "effect"

import { fetchRadios } from "../../domains/radios/repository"
import { promptRadio } from "../../domains/radios/prompts"
import { promptBlockDraft } from "../../domains/playout/prompts"
import { insertBlock } from "../../domains/playout/repository"
import * as Prompter from "../../shared/Prompter"

export const addBlockProgram = Effect.gen(function* () {
	const prompter = yield* Prompter.Prompter
	const availableRadios = yield* fetchRadios

	if (availableRadios.length === 0) {
		yield* Effect.logWarning("No radios were found in the database.")
		return
	}

	const radio = yield* promptRadio(availableRadios)
	const draft = yield* promptBlockDraft(radio)

	yield* Effect.logInfo(`Selected radio: ${radio.name}`)

	if (draft.target.targetType === "audio_file") {
		yield* Effect.logInfo(`Target: audio file ${draft.target.mediaNodeId}`)
	} else {
		yield* Effect.logInfo(`Target: playlist ${draft.target.playlistId}`)
	}

	const confirmed = yield* prompter.confirm({
		message: "Create this block?",
		initialValue: true,
	})

	if (!confirmed) {
		yield* prompter.outro("Nothing was changed.")
		return
	}

	const inserted = yield* insertBlock(radio, draft)

	yield* Effect.logInfo(`Created ${inserted.kind} block ${inserted.id}`)
	yield* prompter.outro("Done.")
})

export const addBlockCommand = Command.make("add-block", {}, () => addBlockProgram)
