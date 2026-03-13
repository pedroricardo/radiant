import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Redacted, Schema } from "effect"
import { Session } from "$lib"
import * as RadiantClient from "../RadiantClient"
import { AuthService, loginOAuth } from "$services/AuthService/AuthService"
import * as OAuth from "$services/AuthService/oauth"
import * as SessionService from "$services/SessionService"

const getProviderOrFail = (provider: string) =>
	Effect.gen(function* () {
		const registry = yield* OAuth.OAuthProvidersRegistry
		const availableProviders = yield* registry.listAvailableProviders
		return yield* registry.getProvider(provider).pipe(
			Effect.mapError(
				() =>
					new RadiantClient.ApiContract.OAuthProviderNotFound({
						got: provider,
						availableProviders,
					}),
			),
		)
	})

const loginOAuthHandler = (providerName: string, code: string) =>
	Effect.gen(function* () {
		yield* getProviderOrFail(providerName)
		return yield* loginOAuth(providerName, code).pipe(
			Effect.mapError(
				(e) =>
					new RadiantClient.ApiContract.OAuthLoginFailed({
						message: String(e),
					}),
			),
		)
	})

export const authGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"auth",
	(handlers) =>
		handlers
			.handle("listOAuthProviders", () => AuthService.listAvailableOAuthProviders)
			.handle("getOAuthAuthorizationUrl", ({ path: { provider } }) =>
				Effect.gen(function* () {
					const p = yield* getProviderOrFail(provider)
					return yield* p.authUrl
				}),
			)
			.handle("oauthCallback", ({ path: { provider }, urlParams: { code } }) =>
				loginOAuthHandler(provider, code),
			)
			.handle("me", () =>
				Effect.gen(function* () {
					const userId = yield* RadiantClient.ApiContract.CurrentUser
					return { userId }
				}),
			),
)

export const AuthorizationLive = Layer.effect(
	RadiantClient.ApiContract.Authorization,
	Effect.gen(function* () {
		const sessionService = yield* SessionService.SessionService
		return {
			bearer: (bearerToken: Redacted.Redacted<string>) =>
				Effect.gen(function* () {
					const raw = Redacted.value(bearerToken)
					const sessionId = yield* Schema.decodeUnknown(Session.SessionId)(raw).pipe(
						Effect.mapError(() => new RadiantClient.ApiContract.Unauthorized()),
					)
					const userId = yield* sessionService.getSessionUser(sessionId).pipe(
						Effect.mapError(() => new RadiantClient.ApiContract.Unauthorized()),
					)
					return userId
				}),
		}
	}),
)

