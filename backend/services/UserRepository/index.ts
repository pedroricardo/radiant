import { eq } from "drizzle-orm"
import { DateTime, Effect, Option } from "effect"
import { UserRepositoryError } from "../../../RadiantClient/lib/User/Http"
import { User } from "../../lib"
import { Drizzle } from "../Drizzle"
import { mediaNodeAudioMetadata } from "../Drizzle/schema/mediaNodeAudioMetadata"
import { mediaNodes } from "../Drizzle/schema/mediaNodes"
import { radios } from "../Drizzle/schema/radios"
import { users as usersTable } from "../Drizzle/schema/user"

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
			getStorageInfo: (userId: User.UserId) =>
				Effect.gen(function* () {
					yield* Effect.logDebug("db.users.getStorageInfo")

					const defaultStorageQuotaBytes = BigInt(
						Bun.env.RADIANT_DEFAULT_STORAGE_QUOTA_BYTES ?? "5000000000",
					)

					const quotaRows = yield* Effect.tryPromise({
						try: () =>
							db
								.select({ storageQuotaBytes: usersTable.storageQuotaBytes })
								.from(usersTable)
								.where(eq(usersTable.id, userId)),
						catch: (cause) =>
							new UserRepositoryError({
								cause,
								message: "failed to query user storage quota",
							}),
					})

					const usedRows = yield* Effect.tryPromise({
						try: () =>
							db
								.select({ sizeBytes: mediaNodeAudioMetadata.sizeBytes })
								.from(mediaNodeAudioMetadata)
								.innerJoin(mediaNodes, eq(mediaNodes.id, mediaNodeAudioMetadata.mediaNodeId))
								.innerJoin(radios, eq(radios.id, mediaNodes.radioId))
								.where(eq(radios.createdByUserId, userId)),
						catch: (cause) =>
							new UserRepositoryError({
								cause,
								message: "failed to query user storage usage",
							}),
					})

					const quotaBytes = quotaRows[0]?.storageQuotaBytes ?? defaultStorageQuotaBytes
					const usedBytes = usedRows.reduce(
						(total, row) => total + (row.sizeBytes ?? BigInt(0)),
						BigInt(0),
					)

					return {
						quotaBytes,
						usedBytes,
						remainingBytes: quotaBytes > usedBytes ? quotaBytes - usedBytes : BigInt(0),
					} as const
				}).pipe(
					Effect.annotateLogs({ userId }),
					Effect.withSpan("UserRepository.getStorageInfo", { attributes: { userId } }),
				),
		}
	}),
}) {}

export { UserRepositoryError as Error }
