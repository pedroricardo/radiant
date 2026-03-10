import type { User } from "$lib";
import { Drizzle } from "$services/Drizzle";
import { users as usersTable } from "$services/Drizzle/schema/user";
import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";
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
			})
		}
	})
}) {}

export {UserRepositoryError as Error}
