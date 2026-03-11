import type { Session, User } from "$lib";
import { Drizzle } from "$services/Drizzle";
import { sessions } from "$services/Drizzle/schema/session";
import { eq } from "drizzle-orm";
import { Data, DateTime, Effect } from "effect";

class SessionServiceError extends Data.TaggedError("SessionServiceError")<{ cause: unknown; message: string }> {}
class SessionNotFoundError extends Data.TaggedError("SessionNotFoundError")<{ sessionId: Session.SessionId }> {}

export class SessionService extends Effect.Service<SessionService>()("SessionService", {
	accessors: true,
	effect: Effect.gen(function* () {
		const db = yield* Drizzle;
		return {
			createSessionForUser: Effect.fn(function* (userId: User.UserId) {
				const createdAt = yield* DateTime.nowAsDate;
				const rows = yield* Effect.tryPromise({
					try: () => db.insert(sessions).values({ userId, createdAt }).returning({ id: sessions.id }),
					catch: (e) => new SessionServiceError({ cause: e, message: "failed to insert session" }),
				});
				return rows[0]!.id;
			}),
			getSessionUser: Effect.fn(function* (sessionId: Session.SessionId) {
				const rows = yield* Effect.tryPromise({
					try: () => db.select().from(sessions).where(eq(sessions.id, sessionId)),
					catch: (e) => new SessionServiceError({ cause: e, message: "failed to query sessions" }),
				});
				const row = rows[0];
				if (!row) {
					return yield* new SessionNotFoundError({ sessionId });
				}
				return row.userId;
			}),
		};
	}),
}) {}

export { SessionServiceError as Error, SessionNotFoundError };
