import type { User } from "$lib";
import { Context, DateTime, Effect, Either, Layer, Option } from "effect";
import type { OAuthUserInfo } from "../OAuthUserInfo";
import { UserNotFoundError, AccountLinkError, AccountLinkLookupError } from "./errors";
import { Drizzle } from "$services/Drizzle";
import * as UserRepository from "$services/UserRepository";
import { oauthAccounts } from "$services/Drizzle/schema/oauthAccountsLinks";
import { and, eq } from "drizzle-orm";

interface AccountLinkServiceAPI {
	linkAccount(userId: User.UserId, oauthUserInfo: OAuthUserInfo): Effect.Effect<void, UserNotFoundError | UserRepository.Error | AccountLinkError>,
	getUserByExternalAccount(oauthUserInfo: OAuthUserInfo): Effect.Effect<Either.Either<User.UserId, OAuthUserInfo>, AccountLinkLookupError>
}
export class AccountLinkService extends Context.Tag("AccountLinkService")<AccountLinkService, AccountLinkServiceAPI>() {}

export const layerDrizzle = Layer.effect(
	AccountLinkService,
	Effect.gen(function* () {
		const db = yield* Drizzle;
		const userRepo = yield* UserRepository.UserRepository;

		return {
			linkAccount: Effect.fn(function* (userId, userInfo) {
				if(!(yield* userRepo.hasUser(userId))) {
					return yield* new UserNotFoundError({userId})
				}
				const now = yield* DateTime.nowAsDate
				yield* Effect.tryPromise({
					try: () => db.insert(oauthAccounts).values({
						provider: userInfo.providerName,
						providerAccountId: userInfo.id,
						userId,
						createdAt: now
					}).onConflictDoUpdate({
						target: [oauthAccounts.userId, oauthAccounts.provider],
						set: {
							providerAccountId: userInfo.id,
							createdAt: now
						}
					}),
					catch: (e) => new AccountLinkError({message: "failed to insert account link into the database", userId, userInfo, cause: e})
				})
			}),
			getUserByExternalAccount: Effect.fn(function* (userInfo) {
				const foundLinks = yield* Effect.tryPromise({
					try: () => db.select().from(oauthAccounts).where(and(eq(oauthAccounts.provider, userInfo.providerName), eq(oauthAccounts.providerAccountId, userInfo.id))),
					catch: (e) => new AccountLinkLookupError({message: "failed to query oauth accounts query", cause: e, oauthUserInfo: userInfo})
				})
				const oauthLink = foundLinks[0]
				return Either.fromNullable(oauthLink?.userId, () => userInfo);
			})
		}
	})
)
