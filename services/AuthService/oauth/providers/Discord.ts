import * as arctic from "arctic"
import { Config, Context, Effect, Layer, Schema } from "effect"
import { OAuthUserInfo } from "../OAuthUserInfo"
import { OAuthValidationError, type OAuthProvider } from "../provider"
import { OAuthProvidersRegistry } from "../provider"

export class DiscordOAuthConfig extends Context.Tag("DiscordOAuthConfig")<
	DiscordOAuthConfig,
	{ clientId: string; clientSecret: string; redirectUri: string }
>() {}

export const DiscordOAuthConfigLive = Layer.effect(
	DiscordOAuthConfig,
	Effect.gen(function* () {
		const clientId = yield* Config.string("DISCORD_CLIENT_ID")
		const clientSecret = yield* Config.string("DISCORD_CLIENT_SECRET")
		const redirectUri = yield* Config.string("DISCORD_REDIRECT_URI")
		return { clientId, clientSecret, redirectUri }
	}),
)

const DiscordUserSchema = Schema.Struct({
	id: Schema.String,
	username: Schema.String,
	global_name: Schema.NullOr(Schema.String),
	avatar: Schema.NullOr(Schema.String),
	email: Schema.optionalWith(Schema.String, { nullable: true }),
})
type DiscordUser = typeof DiscordUserSchema.Type

const fetchDiscordUser = (accessToken: string) =>
	Effect.gen(function* () {
		const res = yield* Effect.tryPromise({
			try: () =>
				fetch("https://discord.com/api/users/@me", {
					headers: { Authorization: `Bearer ${accessToken}` },
				}),
			catch: (cause) =>
				new OAuthValidationError({ message: "failed to call discord /users/@me", cause }),
		})
		if (!res.ok) {
			return yield* new OAuthValidationError({
				message: `discord /users/@me failed: ${res.status}`,
				cause: { status: res.status },
			})
		}
		const json = yield* Effect.tryPromise({
			try: () => res.json(),
			catch: (cause) =>
				new OAuthValidationError({
					message: "failed to parse discord /users/@me response",
					cause,
				}),
		})
		return yield* Schema.decodeUnknown(DiscordUserSchema)(json).pipe(
			Effect.mapError(
				(cause) =>
					new OAuthValidationError({
						message: "failed to decode discord user profile",
						cause,
					}),
			),
		)
	})

const discordAvatarUrl = (id: string, avatar: string | null) => {
	if (avatar) return new URL(`https://cdn.discordapp.com/avatars/${id}/${avatar}.png`)
	// Deterministic fallback; Discord also has embed avatars but this is fine for V1.
	return new URL("https://cdn.discordapp.com/embed/avatars/0.png")
}

export const makeDiscordProvider = (
	config: typeof DiscordOAuthConfig.Service,
): OAuthProvider => {
	const discord = new arctic.Discord(config.clientId, config.clientSecret, config.redirectUri)
	return {
		name: "discord",
		createAuthorizationUrl: (state: string) =>
			Effect.sync(() =>
				discord.createAuthorizationURL(state, null, ["identify", "email"]).toString(),
			),
		exchangeCodeAndGetUserInfo: (code: string) =>
			Effect.gen(function* () {
				const tokens = yield* Effect.tryPromise({
					try: () => discord.validateAuthorizationCode(code, null),
					catch: (cause) =>
						new OAuthValidationError({
							message: "failed to validate discord authorization code",
							cause,
						}),
				})
				const accessToken = tokens.accessToken()
				const user = yield* fetchDiscordUser(accessToken)

				const email = user.email ?? null
				if (!email) {
					return yield* new OAuthValidationError({
						message: "discord user profile did not include email (missing email scope?)",
						cause: user,
					})
				}
				const username = user.global_name ?? user.username
				return new OAuthUserInfo({
					id: user.id,
					username,
					email,
					avatarUrl: discordAvatarUrl(user.id, user.avatar),
					providerName: "discord",
				})
			}),
	}
}

/**
 * Registers the Discord provider into the shared registry.
 *
 * Usage:
 * - provide `DiscordOAuthConfig` (or use `layerFromConfig`)
 * - provide `OAuthProvidersRegistry`
 */
export const layer = Layer.scopedDiscard(
	Effect.gen(function* () {
		const registry = yield* OAuthProvidersRegistry
		const config = yield* DiscordOAuthConfig
		yield* registry.addProvider(makeDiscordProvider(config))
	}),
)

export const layerFromConfig = layer.pipe(Layer.provideMerge(DiscordOAuthConfigLive))
