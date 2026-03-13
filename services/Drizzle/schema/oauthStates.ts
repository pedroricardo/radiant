import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export const oauthStates = pgTable(
	"oauth_states",
	{
		provider: text().notNull(),
		state: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull(),
		consumedAt: timestamp({ withTimezone: true }),
	},
	(t) => [
		primaryKey({
			columns: [t.provider, t.state],
			name: "oauth_state_pk",
		}),
	],
)

