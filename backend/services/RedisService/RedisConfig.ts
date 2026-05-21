import { Config, Context, Effect, Layer, pipe } from "effect"

export interface RedisServiceConfigShape {
	readonly url: string
	readonly options: Bun.RedisOptions | undefined
}

export class RedisServiceConfig extends Context.Tag("RedisServiceConfig")<
	RedisServiceConfig,
	RedisServiceConfigShape
>() {}

export const fromConfig = pipe(
	Effect.Do,
	Effect.bind("url", () =>
		Config.string("REDIS_URL").pipe(
			Config.withDefault(process.env.VALKEY_URL ?? "redis://127.0.0.1:6379"),
		),
	),
	Effect.map(
		(config) =>
			({
				...config,
				options: undefined,
			}) satisfies RedisServiceConfigShape,
	),
	Layer.effect(RedisServiceConfig),
)

export const fromUrl = (url: string, options?: Bun.RedisOptions) =>
	Layer.succeed(RedisServiceConfig, { url, options })
