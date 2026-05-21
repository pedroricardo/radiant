import { Context, Effect, Layer } from "effect"
import { BunRedisClient } from "./BunRedisClient"
import { RedisServiceError, redisServiceError } from "./RedisErrors"

export interface RedisSetOptions {
	readonly ttlMilliseconds?: number | undefined
}

export interface RedisStorageShape {
	readonly get: (key: string) => Effect.Effect<string | null, RedisServiceError>
	readonly set: (
		key: string,
		value: string,
		options?: RedisSetOptions | undefined,
	) => Effect.Effect<void, RedisServiceError>
	readonly delete: (key: string) => Effect.Effect<number, RedisServiceError>
}

export class RedisStorage extends Context.Tag("RedisStorage")<
	RedisStorage,
	RedisStorageShape
>() {}

export const layerBun = Layer.effect(
	RedisStorage,
	Effect.gen(function* () {
		const { commandClient } = yield* BunRedisClient

		return {
			get: (key) =>
				Effect.tryPromise({
					try: () => commandClient.get(key),
					catch: redisServiceError("get", "failed to read Redis key"),
				}),

			set: (key, value, options) =>
				Effect.tryPromise({
					try: async () => {
						if (options?.ttlMilliseconds == null) {
							await commandClient.set(key, value)
							return
						}

						await commandClient.set(key, value, "PX", options.ttlMilliseconds)
					},
					catch: redisServiceError("set", "failed to write Redis key"),
				}),

			delete: (key) =>
				Effect.tryPromise({
					try: () => commandClient.del(key),
					catch: redisServiceError("delete", "failed to delete Redis key"),
				}),
		} satisfies RedisStorageShape
	}),
)
