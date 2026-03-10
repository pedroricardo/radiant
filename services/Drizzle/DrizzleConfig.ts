import { Config, Context, Effect, Layer, pipe } from "effect"

export class DrizzleConfig extends Context.Tag("DrizzleConfig")<
	DrizzleConfig,
	{ databaseUrl: URL }
>() {}

export const use = <T>(callback: (config: typeof DrizzleConfig.Service) => T) =>
	Effect.map(DrizzleConfig, callback)
export const fromConfig = pipe(
	Effect.Do,
	Effect.bind("databaseUrl", () => Config.url("DATABASE_URL")),
	Layer.effect(DrizzleConfig),
)

export const fromDatabaseUrl = (databaseUrl: string | URL) =>
	Layer.succeed(DrizzleConfig, { databaseUrl: new URL(databaseUrl) })
