import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { Playlist } from "../../../lib"

import { DbSchema } from ".."
import { mediaNodeIdType, mediaNodes } from "./mediaNodes"
import { playlistIdType, playlists } from "./playlists"

export const playlistItemIdType = () => DbSchema.id(Playlist.playlistItemIdPrefix).notNull()

export const playlistItems = pgTable(
	"playlist_items",
	{
		id: playlistItemIdType().primaryKey(),
		playlistId: playlistIdType()
			.notNull()
			.references(() => playlists.id, { onDelete: "cascade" }),
		mediaNodeId: mediaNodeIdType()
			.notNull()
			.references(() => mediaNodes.id, { onDelete: "restrict" }),
		kind: text({ enum: ["track", "jingle"] })
			.$type<Playlist.PlaylistItemKind>()
			.notNull()
			.default("track"),
		position: integer().notNull(),
		createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
	},
	(playlistItems) => [
		uniqueIndex("playlist_items_playlist_position_index").on(
			playlistItems.playlistId,
			playlistItems.position,
		),
	],
)
