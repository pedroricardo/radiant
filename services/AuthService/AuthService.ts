import { Data, Effect, Either, Option, pipe } from "effect"
import { AccountLinkService, OAuthProvidersRegistry, OAuthUserInfo } from "./oauth"
import * as UserRepository from "$services/UserRepository"
import * as SessionService from "$services/SessionService"

export class OAuthProviderUnknown extends Data.TaggedError("OAuthProviderUnknown")<{
	availableProviders: string[]
	got: string
}> {
	override toString(): string {
		return `OAuthProviderUnknown: unknown provider ${JSON.stringify(this.got)}, expected one of ${JSON.stringify(this.availableProviders)}`
	}
}

export class OAuthAccountNeedsRegisterException extends Data.TaggedError("OAuthAccountNeedsRegisterException")<{
	userInfo: OAuthUserInfo
}>{}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	accessors: true,
	effect: Effect.gen(function* () {
		let providers = yield* OAuthProvidersRegistry
    let accountLinks = yield* AccountLinkService.AccountLinkService;
		const userRepo = yield* UserRepository.UserRepository;
		return {
			listAvailableOAuthProviders: providers.listAvailableProviders,
			finishOAuthLoginAndGetUserId: Effect.fn(function* (providerName: string, code: string) {
				const provider = yield* providers.getProvider(providerName);
				const userId = yield* pipe(
					code,
					provider.exchangeCodeAndGetUserInfo,
					Effect.andThen(accountLinks.getUserByExternalAccount),
					Effect.andThen(Either.mapLeft((userInfo) => new OAuthAccountNeedsRegisterException({userInfo})))
				)

				return userId
			}),
			registerOAuthUser: Effect.fn(function* (userInfo: OAuthUserInfo) {
				const userId = yield* userRepo.createUser({
					username: userInfo.username,
					email: userInfo.email,
					avatarUrl: userInfo.avatarUrl.toString(),
				})
				yield* accountLinks.linkAccount(userId, userInfo)
				return userId
			}),
		}
	}),
}) {}

export const getOrCreateUserFromOAuthCode = (providerName: string, code: string) =>
	Effect.gen(function* () {
		const auth = yield* AuthService;
		return yield* auth.finishOAuthLoginAndGetUserId(providerName, code).pipe(
			Effect.catchTag("OAuthAccountNeedsRegisterException", (error) =>
				auth.registerOAuthUser(error.userInfo),
			),
		);
	});

export const loginOAuth = (providerName: string, code: string) =>
	Effect.gen(function* () {
		const sessionService = yield* SessionService.SessionService;
		const userId = yield* getOrCreateUserFromOAuthCode(providerName, code);
		const sessionId = yield* sessionService.createSessionForUser(userId);
		return { sessionId, userId };
	});
