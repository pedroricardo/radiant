import * as SessionService from "$services/SessionService"
import * as UserRepository from "$services/UserRepository"
import { Data, Effect } from "effect"
import { AccountLinkService, OAuthProvidersRegistry, OAuthUserInfo } from "./oauth"

export class OAuthProviderUnknown extends Data.TaggedError("OAuthProviderUnknown")<{
	availableProviders: string[]
	got: string
}> {
	override toString(): string {
		return `OAuthProviderUnknown: unknown provider ${JSON.stringify(this.got)}, expected one of ${JSON.stringify(this.availableProviders)}`
	}
}

export class OAuthAccountNeedsRegisterException extends Data.TaggedError(
	"OAuthAccountNeedsRegisterException",
)<{
	userInfo: OAuthUserInfo
}> {}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	accessors: true,
	effect: Effect.gen(function* () {
		const providers = yield* OAuthProvidersRegistry
		const accountLinks = yield* AccountLinkService.AccountLinkService
		const userRepo = yield* UserRepository.UserRepository
		return {
			listAvailableOAuthProviders: providers.listAvailableProviders,
			finishOAuthLoginAndGetUserId: (providerName: string, code: string) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("oauth.finishOAuthLoginAndGetUserId")

					const provider = yield* providers.getProvider(providerName)

					const oauthUserInfo = yield* provider
						.exchangeCodeAndGetUserInfo(code)
						.pipe(
							Effect.tapError((e) =>
								Effect.logWarning("oauth.exchangeCodeAndGetUserInfo_failed").pipe(
									Effect.annotateLogs({ provider: providerName, errorTag: (e as any)?._tag }),
								),
							),
						)

					const lookup = yield* accountLinks.getUserByExternalAccount(oauthUserInfo)
					if (lookup._tag === "Right") {
						yield* Effect.logDebug("oauth.account_link_found")
						return lookup.right
					}

					yield* Effect.logDebug("oauth.account_needs_register")
					return yield* new OAuthAccountNeedsRegisterException({ userInfo: lookup.left })
				}).pipe(
					Effect.annotateLogs({ provider: providerName }),
					Effect.withSpan("AuthService.finishOAuthLoginAndGetUserId", {
						attributes: { provider: providerName },
					}),
				),
			registerOAuthUser: (userInfo: OAuthUserInfo) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("oauth.registerOAuthUser")

					const userId = yield* userRepo.createUser({
						username: userInfo.username,
						email: userInfo.email,
						avatarUrl: userInfo.avatarUrl.toString(),
					})

					yield* accountLinks.linkAccount(userId, userInfo)

					yield* Effect.logInfo("oauth.registerOAuthUser_success").pipe(
						Effect.annotateLogs({ userId }),
					)

					return userId
				}).pipe(
					Effect.annotateLogs({ provider: userInfo.providerName }),
					Effect.withSpan("AuthService.registerOAuthUser", {
						attributes: { provider: userInfo.providerName },
					}),
				),
		}
	}),
}) {}

export const getOrCreateUserFromOAuthCode = (providerName: string, code: string) =>
	Effect.gen(function* () {
		const auth = yield* AuthService
		return yield* auth.finishOAuthLoginAndGetUserId(providerName, code).pipe(
			Effect.catchTag("OAuthAccountNeedsRegisterException", (error) => {
				return auth.registerOAuthUser(error.userInfo)
			}),
			Effect.tapError((e) =>
				Effect.logWarning("oauth.getOrCreateUserFromOAuthCode_failed").pipe(
					Effect.annotateLogs({ provider: providerName, errorTag: (e as any)?._tag }),
				),
			),
		)
	}).pipe(
		Effect.annotateLogs({ provider: providerName }),
		Effect.withSpan("AuthService.getOrCreateUserFromOAuthCode", {
			attributes: { provider: providerName },
		}),
	)

export const loginOAuth = (providerName: string, code: string) =>
	Effect.gen(function* () {
		yield* Effect.logInfo("oauth.loginOAuth")

		const sessionService = yield* SessionService.SessionService
		const userId = yield* getOrCreateUserFromOAuthCode(providerName, code)
		const sessionId = yield* sessionService.createSessionForUser(userId)

		// Note: sessionId is a bearer token; do not log it.
		yield* Effect.logInfo("oauth.loginOAuth_success").pipe(Effect.annotateLogs({ userId }))

		return { sessionId, userId }
	}).pipe(
		Effect.annotateLogs({ provider: providerName }),
		Effect.withSpan("AuthService.loginOAuth", { attributes: { provider: providerName } }),
	)
