import { User } from "$lib"
import { Drizzle } from "$services/Drizzle"
import { users as usersTable } from "$services/Drizzle/schema/user"
import { eq } from "drizzle-orm"
import { Data, DateTime, Effect, Option } from "effect"

class UserRepositoryError extends Data.TaggedError("UserRepositoryError")<{
	cause: unknown
	message: string
}> {}
export class UserRepository extends Effect.Service<UserRepository>()("UserRepository", {
	accessors: true,
	effect: Effect.gen(function* () {
		const db = yield* Drizzle
		return {
			hasUser: (userId: User.UserId) =>
				Effect.gen(function* () {
					yield* Effect.logDebug("db.users.hasUser")

					const rows = yield* Effect.tryPromise({
						try: () =>
							db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)),
						catch: (cause) =>
							new UserRepositoryError({
								cause,
								message: "failed to do select query in `users` table",
							}),
					})

					return rows.length > 0
				}).pipe(
					Effect.annotateLogs({ userId }),
					Effect.withSpan("UserRepository.hasUser", { attributes: { userId } }),
				),
			getUser: (userId: User.UserId) =>
				Effect.gen(function* () {
					yield* Effect.logDebug("db.users.getUser")

					const rows = yield* Effect.tryPromise({
						try: () => db.select().from(usersTable).where(eq(usersTable.id, userId)),
						catch: (cause) =>
							new UserRepositoryError({
								cause,
								message: "failed to do select query in `users` table",
							}),
					})

					return Option.fromNullable(rows[0]).pipe(
						Option.map((u) =>
							User.User.make({
								...u,
								createdAt: DateTime.unsafeFromDate(u.createdAt),
							}),
						),
					)
				}).pipe(
					Effect.annotateLogs({ userId }),
					Effect.withSpan("UserRepository.getUser", { attributes: { userId } }),
				),
			createUser: (
				user: Pick<typeof usersTable.$inferInsert, "username" | "email" | "avatarUrl">,
			) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("db.users.createUser")

					const createdAt = yield* DateTime.nowAsDate
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
						catch: (cause) => new UserRepositoryError({ cause, message: "failed to insert user" }),
					})

					const createdUser = inserted[0]
					const userId =
						createdUser?.id ?? (yield* Effect.dieMessage("Assertion failed: createdUser != null"))

					yield* Effect.logInfo("db.users.createUser_success").pipe(Effect.annotateLogs({ userId }))
					return userId
				}).pipe(
					Effect.annotateLogs({ hasEmail: user.email != null }),
					Effect.withSpan("UserRepository.createUser", {
						attributes: { hasEmail: user.email != null },
					}),
				),
		}
	}),
}) {}

export { UserRepositoryError as Error }
