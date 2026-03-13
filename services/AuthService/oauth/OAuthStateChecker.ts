import * as arctic from "arctic"
import { Context, DateTime, Effect, Layer } from "effect"
import { Drizzle } from "$services/Drizzle"
import { oauthStates } from "$services/Drizzle/schema/oauthStates"
import { and, eq, isNull } from "drizzle-orm"
import { Data } from "effect"

export class OAuthStateIssueError extends Data.TaggedError("OAuthStateIssueError")<{
	message: string
	cause: unknown
}> {}

export class OAuthStateInvalidError extends Data.TaggedError("OAuthStateInvalidError")<{
	provider: string
	state: string
}> {}

export class OAuthStateConsumeError extends Data.TaggedError("OAuthStateConsumeError")<{
	message: string
	cause: unknown
	provider: string
	state: string
}> {}

interface OAuthStateCheckerApi {
	issueState(provider: string): Effect.Effect<string, OAuthStateIssueError>
	consumeState(provider: string, state: string): Effect.Effect<void, OAuthStateInvalidError | OAuthStateConsumeError>
}

export class OAuthStateChecker extends Context.Tag("OAuthStateChecker")<
	OAuthStateChecker,
	OAuthStateCheckerApi
>() {}

export const layerDrizzle = Layer.effect(
	OAuthStateChecker,
	Effect.gen(function* () {
		const db = yield* Drizzle

		return {
			issueState: Effect.fn(function* (provider) {
				const state = arctic.generateState()
				const createdAt = yield* DateTime.nowAsDate
				yield* Effect.tryPromise({
					try: () =>
						db.insert(oauthStates).values({
							provider,
							state,
							createdAt,
							consumedAt: null,
						}),
					catch: (cause) =>
						new OAuthStateIssueError({
							message: "failed to insert oauth state",
							cause,
						}),
				})
				return state
			}),
			consumeState: Effect.fn(function* (provider, state) {
				const consumedAt = yield* DateTime.nowAsDate
				const rows = yield* Effect.tryPromise({
					try: () =>
						db
							.update(oauthStates)
							.set({ consumedAt })
							.where(
								and(
									eq(oauthStates.provider, provider),
									eq(oauthStates.state, state),
									isNull(oauthStates.consumedAt),
								),
							)
							.returning({ provider: oauthStates.provider, state: oauthStates.state }),
					catch: (cause) =>
						new OAuthStateConsumeError({
							message: "failed to consume oauth state",
							cause,
							provider,
							state,
						}),
				})
				if (rows.length === 0) {
					return yield* new OAuthStateInvalidError({ provider, state })
				}
			}),
		}
	}),
)

