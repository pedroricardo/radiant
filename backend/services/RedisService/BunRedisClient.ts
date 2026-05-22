import { Context, Effect, Layer, Scope } from "effect"
import { RedisServiceConfig } from "./RedisConfig"
import { RedisServiceError, redisServiceError } from "./RedisErrors"
type RedisClient = Bun.RedisClient;
export interface BunRedisClientShape {
	readonly commandClient: RedisClient
	readonly duplicateConnectedClient: () => Effect.Effect<RedisClient, RedisServiceError, Scope.Scope>
}

export class BunRedisClient extends Context.Tag("BunRedisClient")<
	BunRedisClient,
	BunRedisClientShape
>() { }

const connectClient = (
	client: RedisClient,
): Effect.Effect<RedisClient, RedisServiceError> =>
	Effect.tryPromise({
		try: async () => {
			await client.connect()
			return client
		},
		catch: redisServiceError("connect", "failed to connect to Redis"),
	})

const duplicateConnectedClient = (
	client: RedisClient,
): Effect.Effect<RedisClient, RedisServiceError, Scope.Scope> => Effect.acquireRelease(Effect.tryPromise({
	try: () => client.duplicate(),
	catch: redisServiceError("duplicate", "failed to duplicate Redis client"),
}).pipe(Effect.flatMap(connectClient)), (client) => Effect.sync(() => client.close()));


export const layer = Layer.scoped(
	BunRedisClient,
	Effect.gen(function*() {
		const config = yield* RedisServiceConfig
		const commandClient = yield* connectClient(new Bun.RedisClient(config.url, config.options))

		yield* Effect.addFinalizer(() => Effect.sync(() => commandClient.close()))

		return {
			commandClient,
			duplicateConnectedClient: () => duplicateConnectedClient(commandClient),
		} satisfies BunRedisClientShape
	}),
)
