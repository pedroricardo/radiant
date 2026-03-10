import { pgTable, varchar } from "drizzle-orm/pg-core"
import { DbSchema } from ".."
import { User } from "$lib"

export const users = pgTable("users", {
    id: DbSchema.id(User.idPrefix).notNull(),
    username: varchar().notNull(),
    passwordHash: varchar().notNull()
})
