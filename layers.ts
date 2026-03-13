import { Layer } from "effect"
import * as Drizzle from "$services/Drizzle"
import * as UserRepository from "$services/UserRepository"
import * as SessionService from "$services/SessionService"
import { AuthService } from "$services/AuthService/AuthService"
import * as OAuth from "$services/AuthService/oauth"
import * as AccountLinkService from "$services/AuthService/oauth/AccountLinkService"

const drizzleConfigLayer = Drizzle.Config.fromConfig
const dbLayer = Drizzle.layer.pipe(Layer.provideMerge(drizzleConfigLayer))

const userRepoLayer = UserRepository.UserRepository.Default.pipe(Layer.provideMerge(dbLayer))
const sessionLayer = SessionService.SessionService.Default.pipe(Layer.provideMerge(dbLayer))

const oauthRegistryLayer = OAuth.OAuthProvidersRegistry.Default
const discordProviderLayer = OAuth.Providers.Discord.layerFromConfig.pipe(
	Layer.provideMerge(oauthRegistryLayer),
)
const githubProviderLayer = OAuth.Providers.GitHub.layerFromConfig.pipe(
	Layer.provideMerge(oauthRegistryLayer),
)

const accountLinkLayer = AccountLinkService.layerDrizzle.pipe(
	Layer.provideMerge(dbLayer),
	Layer.provideMerge(userRepoLayer),
)
const authServiceLayer = AuthService.Default.pipe(
	Layer.provideMerge(oauthRegistryLayer),
	Layer.provideMerge(accountLinkLayer),
	Layer.provideMerge(userRepoLayer),
)

export const ProductionLayer = Layer.mergeAll(
	drizzleConfigLayer,
	dbLayer,
	userRepoLayer,
	sessionLayer,
	oauthRegistryLayer,
	discordProviderLayer,
	githubProviderLayer,
	accountLinkLayer,
	authServiceLayer,
)

