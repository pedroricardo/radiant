import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"
import { Playout } from "../../../lib"

import { DbSchema } from ".."
import { mediaNodeIdType, mediaNodes } from "./mediaNodes"
import { radioIdType, radios } from "./radios"
import { userIdType, users } from "./user"

export const playoutInterruptionIdType = () =>
	DbSchema.id(Playout.playoutInterruptionIdPrefix).notNull()

export const playoutInterruptions = pgTable("playout_interruptions", {
	id: playoutInterruptionIdType().primaryKey(),
	radioId: radioIdType()
		.notNull()
		.references(() => radios.id, { onDelete: "cascade" }),
	mediaNodeId: mediaNodeIdType()
		.notNull()
		.references(() => mediaNodes.id, { onDelete: "restrict" }),
	startsAt: timestamp({ withTimezone: true }).notNull(),
	endsAt: timestamp({ withTimezone: true }),
	modeAfterPlayback: text({ enum: ["overlay"] })
		.$type<Playout.ModeAfterPlayback>()
		.notNull()
		.default("overlay"),
	createdByUserId: userIdType().references(() => users.id, { onDelete: "set null" }),
	note: varchar(),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})
