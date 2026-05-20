import { Effect } from "effect"

import type { Playlist, Radio } from "@radiant/client/lib"
import * as Prompter from "../../shared/Prompter"
import { NoPlaylistsForRadioError } from "./errors"
import type { PlaylistRow } from "./repository"

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
