import type { User } from "$lib";
import { Context, Effect, Layer } from "effect";
import type { OAuthUserInfo } from "../OAuthUserInfo";
import { UserNotFoundError, type AccountLinkError, type AccountLinkLookupError } from "./errors";
import { Drizzle } from "$services/Drizzle";
import * as UserRepository from "$services/UserRepository";

interface AccountLinkServiceAPI {
	linkAccount(userId: User.UserId, oauthUserInfo: OAuthUserInfo): Effect.Effect<void, UserNotFoundError | UserRepository.Error | AccountLinkError>,
	getUserByExternalAccount(oauthUserInfo: OAuthUserInfo): Effect.Effect<User.UserId, AccountLinkLookupError>
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
				// TODO
			}),
			getUserByExternalAccount: Effect.fn(function* (userInfo) {
				return "user_// TODO" as const;
			})
		}
	})
)
