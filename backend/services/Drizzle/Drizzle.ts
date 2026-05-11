import { drizzle } from "drizzle-orm/bun-sql"
import { Context, Effect, Layer } from "effect"
import postgres from "postgres"
import * as DrizzleConfig from "./DrizzleConfig"


export class Drizzle extends Context.Tag("Drizzle")<
	Drizzle,
	ReturnType<typeof drizzle>
>() {}

export const layer = Layer.scoped(
	Drizzle,
	DrizzleConfig.use((c) =>
		Effect.acquireRelease(
			Effect.sync(() => {
				return drizzle(String(c.databaseUrl))
			}),
			(db) => Effect.promise(() => db.$client.end()),
		),
	).pipe(Effect.flatten),
)
