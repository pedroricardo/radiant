import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Redacted, Schema } from "effect"
import { Session } from "$lib"
import * as RadiantClient from "../RadiantClient"
import { AuthService, loginOAuth } from "$services/AuthService/AuthService"
import * as OAuth from "$services/AuthService/oauth"
import * as SessionService from "$services/SessionService"
import { OAuthStateChecker } from "$services/AuthService/oauth"

export const authGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"auth",
	(handlers) =>
		handlers
			.handle("listOAuthProviders", () => AuthService.listAvailableOAuthProviders)
			.handle("getOAuthAuthorizationUrl", ({ path: { provider } }) =>
				Effect.gen(function* () {
					const stateChecker = yield* OAuthStateChecker
					const registry = yield* OAuth.OAuthProvidersRegistry
					const p = yield* registry.getProvider(provider).pipe(
						Effect.catchTag("OAuthProviderUnknownError", (e) =>
							new RadiantClient.ApiContract.OAuthProviderNotFound({
								got: e.got,
								availableProviders: e.availableProviders,
							}),
						),
					)
					const state = yield* stateChecker.issueState(provider).pipe(
						Effect.catchTag(
							"OAuthStateIssueError",
							(e) =>
								new RadiantClient.ApiContract.OAuthAuthorizationUrlFailed({
									message: e.message,
								}),
						),
					)
					return yield* p.createAuthorizationUrl(state)
				}),
			)
			.handle("oauthCallback", ({ path: { provider }, urlParams: { code, state } }) =>
				Effect.gen(function* () {
					const stateChecker = yield* OAuthStateChecker
					yield* stateChecker
						.consumeState(provider, state)
						.pipe(
							Effect.catchTag("OAuthStateInvalidError", () =>
								new RadiantClient.ApiContract.OAuthInvalidState(),
							),
							Effect.catchTag("OAuthStateConsumeError", (e) =>
								new RadiantClient.ApiContract.OAuthLoginFailed({
									message: String(e),
								}),
							),
						)
					return yield* loginOAuth(provider, code).pipe(
						Effect.catchTag("OAuthProviderUnknownError", (e) =>
							new RadiantClient.ApiContract.OAuthProviderNotFound({
								got: e.got,
								availableProviders: e.availableProviders,
							}),
						),
						Effect.catchAll(
							(e) =>
								new RadiantClient.ApiContract.OAuthLoginFailed({
									message: String(e),
								}),
						),
					)
				}),
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
