import * as arctic from "arctic"
import { Config, Context, Effect, Layer, Schema } from "effect"
import { OAuthUserInfo } from "../OAuthUserInfo"
import { OAuthProvidersRegistry, OAuthValidationError, type OAuthProvider } from "../provider"

export class GitHubOAuthConfig extends Context.Tag("GitHubOAuthConfig")<
	GitHubOAuthConfig,
	{ clientId: string; clientSecret: string; redirectUri: string }
>() {}

export const GitHubOAuthConfigLive = Layer.effect(
	GitHubOAuthConfig,
	Effect.gen(function* () {
		const clientId = yield* Config.string("GITHUB_CLIENT_ID")
		const clientSecret = yield* Config.string("GITHUB_CLIENT_SECRET")
		const redirectUri = yield* Config.string("GITHUB_REDIRECT_URI")
		return { clientId, clientSecret, redirectUri }
	}),
)

const GitHubUserSchema = Schema.Struct({
	id: Schema.Number,
	login: Schema.String,
	avatar_url: Schema.String,
	email: Schema.NullOr(Schema.String),
})
type GitHubUser = typeof GitHubUserSchema.Type

const GitHubEmailSchema = Schema.Struct({
	email: Schema.String,
	primary: Schema.Boolean,
	verified: Schema.Boolean,
	visibility: Schema.NullOr(Schema.String),
})
type GitHubEmail = typeof GitHubEmailSchema.Type

const fetchGitHubJson = <A, I>(
	url: string,
	accessToken: string,
	message: string,
	schema: Schema.Schema<A, I, never>,
) =>
	Effect.gen(function* () {
		yield* Effect.logDebug("oauth.github.fetchJson").pipe(Effect.annotateLogs({ url }))
		const res = yield* Effect.tryPromise({
			try: () =>
				fetch(url, {
					headers: {
						Authorization: `Bearer ${accessToken}`,
						Accept: "application/vnd.github+json",
						"X-GitHub-Api-Version": "2022-11-28",
					},
				}),
			catch: (cause) => new OAuthValidationError({ message, cause }),
		})
		if (!res.ok) {
			yield* Effect.logWarning("oauth.github.fetchJson_failed").pipe(
				Effect.annotateLogs({ url, status: res.status }),
			)
			return yield* new OAuthValidationError({
				message: `github request failed: ${url} (${res.status})`,
				cause: { status: res.status },
			})
		}
		const json = yield* Effect.tryPromise({
			try: () => res.json(),
			catch: (cause) =>
				new OAuthValidationError({ message: `failed to parse github response: ${url}`, cause }),
		})
		return yield* Schema.decodeUnknown(schema)(json).pipe(
			Effect.mapError(
				(cause) =>
					new OAuthValidationError({
						message: `failed to decode github response: ${url}`,
						cause,
					}),
			),
		)
	}).pipe(Effect.withSpan("OAuth.GitHub.fetchJson", { attributes: { url } }))

const pickBestEmail = (emails: ReadonlyArray<GitHubEmail>): string | null => {
	const primaryVerified = emails.find((e) => e.primary && e.verified)
	if (primaryVerified) return primaryVerified.email
	const anyVerified = emails.find((e) => e.verified)
	return anyVerified?.email ?? null
}

export const makeGitHubProvider = (config: typeof GitHubOAuthConfig.Service): OAuthProvider => {
	const github = new arctic.GitHub(config.clientId, config.clientSecret, config.redirectUri)
	return {
		name: "github",
		createAuthorizationUrl: (state: string) =>
			Effect.sync(() =>
				github.createAuthorizationURL(state, ["read:user", "user:email"]).toString(),
			),
		exchangeCodeAndGetUserInfo: (code: string) =>
			Effect.gen(function* () {
				yield* Effect.logInfo("oauth.github.exchangeCodeAndGetUserInfo")
				const tokens = yield* Effect.tryPromise({
					try: () => github.validateAuthorizationCode(code),
					catch: (cause) =>
						new OAuthValidationError({
							message: "failed to validate github authorization code",
							cause,
						}),
				})
				const accessToken = tokens.accessToken()

				const user = yield* fetchGitHubJson(
					"https://api.github.com/user",
					accessToken,
					"failed to fetch github user profile",
					GitHubUserSchema,
				)

				const email =
					user.email ??
					pickBestEmail(
						yield* fetchGitHubJson(
							"https://api.github.com/user/emails",
							accessToken,
							"failed to fetch github user emails",
							Schema.Array(GitHubEmailSchema),
						),
					)

				if (!email) {
					return yield* new OAuthValidationError({
						message: "github user profile did not include a usable email",
						cause: user,
					})
				}

				return new OAuthUserInfo({
					id: String(user.id),
					username: user.login,
					email,
					avatarUrl: new URL(user.avatar_url),
					providerName: "github",
				})
			}).pipe(
				Effect.annotateLogs({ provider: "github" }),
				Effect.withSpan("OAuth.GitHub.exchangeCodeAndGetUserInfo"),
			),
	}
}

export const layer = Layer.scopedDiscard(
	Effect.gen(function* () {
		const registry = yield* OAuthProvidersRegistry
		const config = yield* GitHubOAuthConfig
		yield* registry.addProvider(makeGitHubProvider(config))
	}),
)

export const layerFromConfig = layer.pipe(Layer.provideMerge(GitHubOAuthConfigLive))
