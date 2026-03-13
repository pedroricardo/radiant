import type { User } from "$lib";
import { Drizzle } from "$services/Drizzle";
import { users as usersTable } from "$services/Drizzle/schema/user";
import { eq } from "drizzle-orm";
import { Data, DateTime, Effect } from "effect";
class UserRepositoryError extends Data.TaggedError("UserRepositoryError")<{cause: unknown, message: string}>{}
export class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
	accessors: true,
	effect: Effect.gen(function* () {
		const db = yield* Drizzle;
		return {
			hasUser: Effect.fn(function* (userId: User.UserId) {
				const user = yield* Effect.tryPromise({
					try: () => db.select({id: usersTable.id}).from(usersTable).where(eq(usersTable.id, userId)),
					catch: (e) => new UserRepositoryError({cause: e, message: "failed to do select query in `users` table"})
				});
				return user.length > 0;
			}),
			createUser: Effect.fn(function* (user: Pick<typeof usersTable.$inferInsert, "username" | "email" | "avatarUrl">) {
				const createdAt = yield* DateTime.nowAsDate;
				const inserted = yield* Effect.tryPromise({
					try: () =>
						db
							.insert(usersTable)
							.values({
								username: user.username,
								email: user.email,
								avatarUrl: user.avatarUrl,
								createdAt,
							})
							.returning({ id: usersTable.id }),
					catch: (e) => new UserRepositoryError({ cause: e, message: "failed to insert user" }),
				});
				const createdUser = inserted[0];
				return createdUser?.id ?? (yield* Effect.dieMessage("Assertion failed: createdUser != null"));
			})
		}
	})
}) {}

export {UserRepositoryError as Error}
