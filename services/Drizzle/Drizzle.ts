import { drizzle } from "drizzle-orm/bun-sql"
import { Context, Effect, Layer, pipe } from "effect"
import * as DrizzleConfig from "./DrizzleConfig"

export class Drizzle extends Context.Tag("Drizzle")<Drizzle, ReturnType<typeof drizzle>>() {}

export const layer = Layer.effect(
	Drizzle,
	DrizzleConfig.use((c) => drizzle(String(c.databaseUrl)))
)
