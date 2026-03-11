import { Session } from "$lib"
import { DbSchema } from ".."
import { pgTable, timestamp } from "drizzle-orm/pg-core"
import { userIdType, users } from "./user"

export const sessionIdType = () => DbSchema.id(Session.idPrefix).notNull()

export const sessions = pgTable("sessions", {
	id: sessionIdType().primaryKey(),
	userId: userIdType()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})
