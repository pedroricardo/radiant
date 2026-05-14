import { and, eq } from "drizzle-orm"
import { Context, DateTime, Effect, Either, Layer } from "effect"
import type { User } from "../../../../lib"
import { Drizzle } from "../../../Drizzle"
import { oauthAccounts } from "../../../Drizzle/schema/oauthAccountsLinks"
import * as UserRepository from "../../../UserRepository"
import type { OAuthUserInfo } from "../OAuthUserInfo"
import { AccountLinkError, AccountLinkLookupError, UserNotFoundError } from "./errors"

interface AccountLinkServiceAPI {
	linkAccount(
		userId: User.UserId,
		oauthUserInfo: OAuthUserInfo,
	): Effect.Effect<void, UserNotFoundError | UserRepository.Error | AccountLinkError>
	getUserByExternalAccount(
		oauthUserInfo: OAuthUserInfo,
	): Effect.Effect<Either.Either<User.UserId, OAuthUserInfo>, AccountLinkLookupError>
}
export class AccountLinkService extends Context.Tag("AccountLinkService")<
	AccountLinkService,
	AccountLinkServiceAPI
>() {}

export const layerDrizzle = Layer.effect(
	AccountLinkService,
	Effect.gen(function* () {
		const db = yield* Drizzle
		const userRepo = yield* UserRepository.UserRepository

		return {
			linkAccount: (userId, userInfo) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("oauth.linkAccount")

					if (!(yield* userRepo.hasUser(userId))) {
						yield* Effect.logWarning("oauth.linkAccount_user_not_found")
						return yield* new UserNotFoundError({ userId })
					}

					const now = yield* DateTime.nowAsDate
					yield* Effect.tryPromise({
						try: () =>
							db
								.insert(oauthAccounts)
								.values({
									provider: userInfo.providerName,
									providerAccountId: userInfo.id,
									userId,
									createdAt: now,
								})
								.onConflictDoUpdate({
									target: [oauthAccounts.userId, oauthAccounts.provider],
									set: {
										providerAccountId: userInfo.id,
										createdAt: now,
									},
								}),
						catch: (cause) =>
							new AccountLinkError({
								message: "failed to insert account link into the database",
								userId,
								userInfo,
								cause,
							}),
					})

					yield* Effect.logInfo("oauth.linkAccount_success")
				}).pipe(
					Effect.annotateLogs({ userId, provider: userInfo.providerName }),
					Effect.withSpan("AccountLinkService.linkAccount", {
						attributes: { provider: userInfo.providerName },
					}),
				),
			getUserByExternalAccount: (userInfo) =>
				Effect.gen(function* () {
					yield* Effect.logDebug("oauth.getUserByExternalAccount")

					const foundLinks = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(oauthAccounts)
								.where(
									and(
										eq(oauthAccounts.provider, userInfo.providerName),
										eq(oauthAccounts.providerAccountId, userInfo.id),
									),
								),
						catch: (cause) =>
							new AccountLinkLookupError({
								message: "failed to query oauth accounts query",
								cause,
								oauthUserInfo: userInfo,
							}),
					})
					const oauthLink = foundLinks[0]
					return Either.fromNullable(oauthLink?.userId, () => userInfo)
				}).pipe(
					Effect.annotateLogs({ provider: userInfo.providerName }),
					Effect.withSpan("AccountLinkService.getUserByExternalAccount", {
						attributes: { provider: userInfo.providerName },
					}),
				),
		}
	}),
)
