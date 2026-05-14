import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core"
import { Playlist } from "../../../lib"

import { DbSchema } from ".."
import { radioIdType, radios } from "./radios"

export const playlistIdType = () => DbSchema.id(Playlist.idPrefix).notNull()

export const playlists = pgTable(
	"playlists",
	{
		id: playlistIdType().primaryKey(),
		radioId: radioIdType()
			.notNull()
			.references(() => radios.id, { onDelete: "cascade" }),
		name: varchar().notNull(),
		description: varchar(),
		playbackMode: text({ enum: ["linear", "shuffle"] })
			.$type<Playlist.PlaylistPlaybackMode>()
			.notNull()
			.default("linear"),
		preventImmediateRepeats: boolean().notNull().default(false),
		crossfadeOverrideMs: integer(),
		jingleMinGapTracks: integer(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(playlists) => [uniqueIndex("playlists_radio_name_index").on(playlists.radioId, playlists.name)],
)
