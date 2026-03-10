import { Drizzle } from "$services"
import { defineConfig } from "drizzle-kit"
import { Effect, pipe } from "effect"

export default await pipe(
	Drizzle.Config.use((config) =>
		defineConfig({
			dialect: "postgresql",
			schema: "./services/Drizzle/schema",
			dbCredentials: {
				url: String(config.databaseUrl),
			},
		}),
	),
	Effect.provide(Drizzle.Config.fromConfig),
	Effect.runPromise,
)
