import { Cause, Data } from "effect"

export class RedisServiceError extends Data.TaggedError("RedisServiceError")<{
	readonly operation:
		| "connect"
		| "duplicate"
		| "get"
		| "set"
		| "delete"
		| "publish"
		| "subscribe"
		| "unsubscribe"
	readonly message: string
}> {}

export const redisServiceError =
	(operation: RedisServiceError["operation"], fallbackMessage: string) => (cause: unknown) =>
		new RedisServiceError({
			operation,
			message:
				cause instanceof globalThis.Error
					? cause.message
					: `${fallbackMessage}\n${Cause.pretty(Cause.die(cause))}`,
		})
