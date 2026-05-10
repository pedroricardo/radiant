import { Auth, Session } from "$lib"
import { AuthService, loginOAuth } from "$services/AuthService/AuthService"
import * as OAuth from "$services/AuthService/oauth"
import { OAuthStateChecker } from "$services/AuthService/oauth"
import * as SessionService from "$services/SessionService"
import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Redacted, Schema } from "effect"
import * as RadiantClient from "../RadiantClient"

export const authGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"auth",
	(handlers) =>
		handlers
			.handle("listOAuthProviders", () =>
				AuthService.listAvailableOAuthProviders.pipe(
					Effect.withSpan("http.auth.listOAuthProviders", { kind: "server" }),
				),
			)
			.handle("getOAuthAuthorizationUrl", ({ path: { provider } }) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("http.auth.getOAuthAuthorizationUrl")
					const stateChecker = yield* OAuthStateChecker
					const registry = yield* OAuth.OAuthProvidersRegistry
					const p = yield* registry.getProvider(provider).pipe(
						Effect.catchTag(
							"OAuthProviderUnknownError",
							(e) =>
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
				}).pipe(
					Effect.annotateLogs({ provider }),
					Effect.withSpan("http.auth.getOAuthAuthorizationUrl", {
						kind: "server",
						attributes: { provider },
					}),
				),
			)
			.handle("oauthCallback", ({ path: { provider }, urlParams: { code, state } }) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("http.auth.oauthCallback")
					const stateChecker = yield* OAuthStateChecker
					yield* stateChecker.consumeState(provider, state).pipe(
						Effect.catchTag(
							"OAuthStateInvalidError",
							() => new RadiantClient.ApiContract.OAuthInvalidState(),
						),
						Effect.catchTag("OAuthStateConsumeError", (e) =>
							Effect.logError(e).pipe(
								Effect.andThen(
									() =>
										new RadiantClient.ApiContract.OAuthLoginFailed({
											message: String(e),
										}),
								),
							),
						),
					)

					return yield* loginOAuth(provider, code).pipe(
						Effect.catchTag(
							"OAuthProviderUnknownError",
							(e) =>
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
						Effect.tap((r) =>
							HttpApiBuilder.securitySetCookie(Auth.security.cookie, r.sessionId, {
								path: "/",
								sameSite: "none",
								secure: true,
							}),
						),
					)
				}).pipe(
					Effect.annotateLogs({ provider }),
					Effect.withSpan("http.auth.oauthCallback", {
						kind: "server",
						attributes: { provider },
					}),
				),
			),
)

export const AuthorizationLive = Layer.effect(
	RadiantClient.ApiContract.Authorization,
	Effect.gen(function* () {
		const sessionService = yield* SessionService.SessionService
		const handler = (bearerToken: Redacted.Redacted<string>) =>
			Effect.gen(function* () {
				const raw = Redacted.value(bearerToken)
				const sessionId = yield* Schema.decodeUnknown(Session.SessionId)(raw).pipe(
					Effect.tapError(() => Effect.logDebug("auth.bearer.invalid_token")),
					Effect.mapError(() => new RadiantClient.ApiContract.Unauthorized()),
				)
				const userId = yield* sessionService.getSessionUser(sessionId).pipe(
					Effect.tapError(() => Effect.logDebug("auth.bearer.session_not_found")),
					Effect.mapError(() => new RadiantClient.ApiContract.Unauthorized()),
				)
				return userId
			}).pipe(
				Effect.annotateLogs({ tokenLength: Redacted.value(bearerToken).length }),
				Effect.withSpan("http.auth.bearer", { kind: "server" }),
			)
		return {
			bearer: handler,
			cookie: handler,
		}
	}),
)
