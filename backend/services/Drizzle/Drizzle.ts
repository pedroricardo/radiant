import { Context, Effect, Layer } from "effect"
import * as DrizzleConfig from "./DrizzleConfig"

export class Drizzle extends Context.Tag("Drizzle")<
	Drizzle,
	ReturnType<typeof import("drizzle-orm/bun-sql").drizzle>
>() {}

export const layer = Layer.scoped(
	Drizzle,
	DrizzleConfig.use((c) =>
		Effect.acquireRelease(
			Effect.promise(async () => {
				const { drizzle } = await import("drizzle-orm/bun-sql") // This prevents next build from tripping up on trying to import from "bun" modules
				return drizzle(String(c.databaseUrl))
			}),
			(db) => Effect.promise(() => db.$client.end()),
		),
	).pipe(Effect.flatten),
)
