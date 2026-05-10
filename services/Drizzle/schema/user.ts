import { User } from "$lib"
import { pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { DbSchema } from ".."
export const userIdType = () => DbSchema.id(User.idPrefix).notNull()
export const users = pgTable(
	"users",
	{
		id: userIdType().primaryKey(),
		username: varchar().notNull(),
		email: varchar().notNull(),
		avatarUrl: varchar().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(users) => [uniqueIndex("usersEmailIndex").on(users.email)],
)
