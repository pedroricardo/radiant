import { Effect } from "effect"

import type { PlaylistRow } from "./repository"
import type { Radio } from "@radiant/client/lib"
import type { Playlist } from "@radiant/client/lib"
import { NoPlaylistsForRadioError } from "./errors"
import * as Prompter from "../../shared/Prompter"

export const promptPlaylist = (
	radio: { id: Radio.RadioId; name: string },
	rows: ReadonlyArray<PlaylistRow>,
) => {
	if (rows.length === 0) {
		return Effect.fail(
			NoPlaylistsForRadioError.forRadio({
				radioId: radio.id,
				radioName: radio.name,
			}),
		)
	}

	return Effect.flatMap(Prompter.Prompter, (prompter) =>
		prompter.select({
			message: "Which playlist should this block play?",
			options: rows.map((playlist) => ({
				value: playlist.id,
				label: playlist.name,
				hint: playlist.description ?? undefined,
			})),
		}),
	).pipe(Effect.map((playlistId) => playlistId as Playlist.PlaylistId))
}
