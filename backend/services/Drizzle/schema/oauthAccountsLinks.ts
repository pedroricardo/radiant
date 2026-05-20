import { pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { userIdType, users } from "./user"

export const oauthAccounts = pgTable(
	"oauth_accounts",
	{
		userId: userIdType()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		provider: text().notNull(),
		providerAccountId: text().notNull(),
		createdAt: timestamp({ withTimezone: false, mode: "string" }).defaultNow().notNull(),
	},
	(oauthAccounts) => [
		primaryKey({
			columns: [oauthAccounts.provider, oauthAccounts.userId],
			name: "provider_account_unique",
		}),
		uniqueIndex("provider_account_id_unique_index").on(
			oauthAccounts.provider,
			oauthAccounts.userId,
		),
	],
)
