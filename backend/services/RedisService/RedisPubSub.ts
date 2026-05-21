import { Context, Effect, Layer, Queue, Scope } from "effect"
import { BunRedisClient } from "./BunRedisClient"
import { RedisServiceError, redisServiceError } from "./RedisErrors"

export interface RedisPubSubMessage {
	readonly channel: string
	readonly message: string
}

export interface RedisPubSubShape {
	readonly publish: (channel: string, message: string) => Effect.Effect<number, RedisServiceError>
	readonly subscribe: (channel: string) => Effect.Effect<Queue.Dequeue<RedisPubSubMessage>, RedisServiceError, Scope.Scope>
	readonly subscribeMany: (
		channels: ReadonlyArray<string>,
	) => Effect.Effect<Queue.Dequeue<RedisPubSubMessage>, RedisServiceError, Scope.Scope>
}

export class RedisPubSub extends Context.Tag("RedisPubSub")<RedisPubSub, RedisPubSubShape>() { }

const makeSubscriptionQueue = (
	client: BunRedisClient["Type"],
	channels: ReadonlyArray<string>,
): Effect.Effect<Queue.Dequeue<RedisPubSubMessage>, RedisServiceError, Scope.Scope> => {

		return Effect.gen(function*() {
			const queue = yield* Queue.unbounded<RedisPubSubMessage>();
			yield* Effect.addFinalizer(() => queue.shutdown);
			const subscriptionClient = yield* client.duplicateConnectedClient()
			const listener = (message: string, channel: string) => {
				queue.unsafeOffer({
					channel,
					message,
				})
			}

			yield* Effect.tryPromise({
				try: () => subscriptionClient.subscribe([...channels], listener),
				catch: redisServiceError("subscribe", "failed to subscribe to Redis channel"),
			})

			yield* Effect.addFinalizer(() =>
				Effect.promise(async () => {
					if (channels.length === 1) {
						const [channel] = channels
						if (channel != null) {
							await subscriptionClient.unsubscribe(channel, listener)
						}
					} else {
						await subscriptionClient.unsubscribe([...channels])
					}
				})
			)
			return queue;
		})
}

export const layerBun = Layer.effect(
	RedisPubSub,
	Effect.gen(function*() {
		const client = yield* BunRedisClient

		return {
			publish: (channel, message) =>
				Effect.tryPromise({
					try: () => client.commandClient.publish(channel, message),
					catch: redisServiceError("publish", "failed to publish Redis message"),
				}),

			subscribe: (channel) => makeSubscriptionQueue(client, [channel]),

			subscribeMany: (channels) => makeSubscriptionQueue(client, channels),
		} satisfies RedisPubSubShape
	}),
)

export const NoopRedisPubSub = Layer.effect(
	RedisPubSub,
	Effect.gen(function* () {
		const emptyQueue = () => Queue.unbounded<RedisPubSubMessage>()

		return {
			publish: () => Effect.succeed(0),
			subscribe: () => emptyQueue(),
			subscribeMany: () => emptyQueue(),
		} satisfies RedisPubSubShape
	}),
)
