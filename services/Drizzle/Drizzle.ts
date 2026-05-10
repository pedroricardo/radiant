import { drizzle } from "drizzle-orm/bun-sql"
import { Context, Effect, Layer } from "effect"
import * as DrizzleConfig from "./DrizzleConfig"

export class Drizzle extends Context.Tag("Drizzle")<Drizzle, ReturnType<typeof drizzle>>() {}

export const layer = Layer.scoped(
	Drizzle,
	DrizzleConfig.use((c) =>
		Effect.acquireRelease(
			Effect.sync(() => drizzle(String(c.databaseUrl))),
			(db) => Effect.promise(() => db.$client.close()),
		),
	).pipe(Effect.flatten),
)
