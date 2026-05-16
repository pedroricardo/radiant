import { eq } from "drizzle-orm"
import { Data, DateTime, Effect } from "effect"
import type { Session, User } from "../../lib"
import { Drizzle } from "../Drizzle"
import { sessions } from "../Drizzle/schema/session"

class SessionServiceError extends Data.TaggedError("SessionServiceError")<{
	cause: unknown
	message: string
}> {}
class SessionNotFoundError extends Data.TaggedError("SessionNotFoundError")<{
	sessionId: Session.SessionId
}> {}

export class SessionService extends Effect.Service<SessionService>()("SessionService", {
	accessors: true,
	effect: Effect.gen(function* () {
		const db = yield* Drizzle
		return {
			createSessionForUser: (userId: User.UserId) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("db.sessions.createSessionForUser")

					const createdAt = yield* Effect.map(DateTime.nowAsDate, (d) => d.toISOString())
					const rows = yield* Effect.tryPromise({
						try: () =>
							db.insert(sessions).values({ userId, createdAt }).returning({ id: sessions.id }),
						catch: (cause) =>
							new SessionServiceError({ cause, message: "failed to insert session" }),
					})

					// Note: session id is a bearer token; do not log it.
					return rows[0]!.id
				}).pipe(
					Effect.annotateLogs({ userId }),
					Effect.withSpan("SessionService.createSessionForUser", { attributes: { userId } }),
				),
			getSessionUser: (sessionId: Session.SessionId) =>
				Effect.gen(function* () {
					yield* Effect.logDebug("db.sessions.getSessionUser")

					const rows = yield* Effect.tryPromise({
						try: () => db.select().from(sessions).where(eq(sessions.id, sessionId)),
						catch: (cause) =>
							new SessionServiceError({ cause, message: "failed to query sessions" }),
					})
					const row = rows[0]
					if (!row) {
						yield* Effect.logDebug("db.sessions.not_found")
						return yield* new SessionNotFoundError({ sessionId })
					}
					return row.userId
				}).pipe(Effect.withSpan("SessionService.getSessionUser")),
		}
	}),
}) {}

export { SessionServiceError as Error, SessionNotFoundError }
