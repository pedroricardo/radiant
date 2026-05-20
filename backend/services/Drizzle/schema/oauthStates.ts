import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export const oauthStates = pgTable(
	"oauth_states",
	{
		provider: text().notNull(),
		state: text().notNull(),
		createdAt: timestamp({ withTimezone: false, mode: "string" }).notNull(),
		consumedAt: timestamp({ withTimezone: false, mode: "string" }),
	},
	(t) => [
		primaryKey({
			columns: [t.provider, t.state],
			name: "oauth_state_pk",
		}),
	],
)
