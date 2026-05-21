import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { Playout } from "../../../lib"

import { DbSchema } from ".."
import { mediaNodeIdType, mediaNodes } from "./mediaNodes"
import { playlistIdType, playlists } from "./playlists"
import { radioIdType, radios } from "./radios"

export const scheduleWeeklyBlockIdType = () =>
	DbSchema.id(Playout.scheduleWeeklyBlockIdPrefix).notNull()

export const scheduleWeeklyBlocks = pgTable("schedule_weekly_blocks", {
	id: scheduleWeeklyBlockIdType().primaryKey(),
	radioId: radioIdType()
		.notNull()
		.references(() => radios.id, { onDelete: "cascade" }),
	weekday: integer().notNull(),
	startMinuteOfDay: integer().notNull(),
	endMinuteOfDay: integer().notNull(),
	targetType: text({ enum: ["playlist", "audio_file"] })
		.$type<Playout.ScheduleTargetType>()
		.notNull(),
	playlistId: playlistIdType().references(() => playlists.id, { onDelete: "restrict" }),
	mediaNodeId: mediaNodeIdType().references(() => mediaNodes.id, { onDelete: "restrict" }),
	playlistFillMode: text({ enum: ["once", "loop"] }).$type<Playout.PlaylistFillMode>(),
	playbackMode: text({ enum: ["continue", "restart"] })
		.$type<Playout.BlockPlaybackMode>()
		.notNull()
		.default("continue"),
	modeAfterPlayback: text({ enum: ["overlay"] })
		.$type<Playout.ModeAfterPlayback>()
		.notNull()
		.default("overlay"),
	createdAt: timestamp({ withTimezone: false, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: false, mode: "string" }).defaultNow().notNull(),
})
