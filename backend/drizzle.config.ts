import { defineConfig } from "drizzle-kit"
import { Effect, pipe } from "effect"
import { Drizzle } from "./services"

export default pipe(
	Drizzle.Config.use((config) =>
		defineConfig({
			dialect: "postgresql",
			schema: "./backend/services/Drizzle/schema/",
			dbCredentials: {
				url: String(config.databaseUrl),
			},
		}),
	),
	Effect.provide(Drizzle.Config.fromConfig),
	Effect.runSync,
)
