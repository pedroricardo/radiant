import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core"
import { Radio } from "../../../lib"

import { DbSchema } from ".."
import { userIdType, users } from "./user"

export const radioIdType = () => DbSchema.id(Radio.idPrefix).notNull()

export const radios = pgTable("radios", {
	id: radioIdType().primaryKey(),
	name: varchar().notNull(),
	description: varchar(),
	timezone: varchar().notNull(),
	defaultCrossfadeMs: integer().notNull().default(0),
	isPublic: boolean().notNull().default(false),
	createdByUserId: userIdType()
		.notNull()
		.references(() => users.id, { onDelete: "restrict" }),
	createdAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
})
