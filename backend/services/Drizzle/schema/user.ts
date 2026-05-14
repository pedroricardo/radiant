import { bigint, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { DbSchema } from ".."
import { User } from "../../../lib"
export const userIdType = () => DbSchema.id(User.idPrefix).notNull()
export const users = pgTable(
	"users",
	{
		id: userIdType().primaryKey(),
		username: varchar().notNull(),
		email: varchar().notNull(),
		avatarUrl: varchar().notNull(),
		storageQuotaBytes: bigint({ mode: "bigint" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(users) => [uniqueIndex("usersEmailIndex").on(users.email)],
)
