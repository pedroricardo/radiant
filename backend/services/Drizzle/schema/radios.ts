import { Radio } from "../../../lib"
import { boolean, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { DbSchema } from ".."
import { userIdType, users } from "./user"

export const radioIdType = () => DbSchema.id(Radio.idPrefix).notNull()

export const radios = pgTable(
	"radios",
	{
		id: radioIdType().primaryKey(),
		name: varchar().notNull(),
		slug: varchar().notNull(),
		description: varchar(),
		timezone: varchar().notNull(),
		defaultCrossfadeMs: integer().notNull().default(0),
		isPublic: boolean().notNull().default(false),
		createdByUserId: userIdType()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(radios) => [
		uniqueIndex("radiosSlugIndex").on(radios.slug),
		uniqueIndex("radiosNameIndex").on(radios.name),
	],
)
