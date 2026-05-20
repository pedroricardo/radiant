import { asc, eq } from "drizzle-orm"
import { Effect } from "effect"

import * as Drizzle from "@radiant/backend/services/Drizzle"
import { playlists } from "@radiant/backend/services/Drizzle/schema/playlists"
import type { Radio } from "@radiant/client/lib"
import { FetchPlaylistsError } from "./errors"

export type PlaylistRow = typeof playlists.$inferSelect

export const fetchPlaylists = (radioId: Radio.RadioId) =>
	Effect.gen(function* () {
		const db = yield* Drizzle.Drizzle

		return yield* Effect.tryPromise({
			try: () =>
				db
					.select()
					.from(playlists)
					.where(eq(playlists.radioId, radioId))
					.orderBy(asc(playlists.name)),
			catch: (cause) => new FetchPlaylistsError({ radioId, cause }),
		})
	})
