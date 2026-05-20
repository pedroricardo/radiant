import { Effect } from "effect"

import type { MediaNode, Radio } from "@radiant/client/lib"
import * as Prompter from "../../shared/Prompter"
import { NoAudioNodesForRadioError } from "./errors"
import type { AudioNodeRow } from "./repository"

const formatAudioNodeLabel = (row: AudioNodeRow) => {
	const title = row.media_node_audio_metadata.title ?? row.media_nodes.name
	const artist = row.media_node_audio_metadata.artist
	return artist != null ? `${title} - ${artist}` : title
}

export const promptAudioNode = (
	radio: { id: Radio.RadioId; name: string },
	rows: ReadonlyArray<AudioNodeRow>,
) => {
	if (rows.length === 0) {
		return Effect.fail(
			NoAudioNodesForRadioError.forRadio({
				radioId: radio.id,
				radioName: radio.name,
			}),
		)
	}

	return Effect.flatMap(Prompter.Prompter, (prompter) =>
		prompter.select({
			message: "Which audio file should this block play?",
			options: rows.map((node) => ({
				value: node.media_nodes.id,
				label: formatAudioNodeLabel(node),
				hint: node.media_nodes.name,
			})),
		}),
	).pipe(Effect.map((mediaNodeId) => mediaNodeId as MediaNode.MediaNodeId))
}
