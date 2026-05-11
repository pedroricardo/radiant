import * as Drizzle from "./services/Drizzle"
import { IcyEncoder, RadioManager } from "./services"
import { AuthService } from "./services/AuthService/AuthService"
import * as OAuth from "./services/AuthService/oauth"
import { layerDrizzle as oauthStateCheckerLayer } from "./services/AuthService/oauth"
import * as AccountLinkService from "./services/AuthService/oauth/AccountLinkService"
import * as SessionService from "./services/SessionService"
import * as UserRepository from "./services/UserRepository"
import { Layer } from "effect"
import { TestDbLayer } from "./test/support/testDb"

// const drizzleConfigLayer = Drizzle.Config.fromConfig
// const dbLayer = Drizzle.layer.pipe(Layer.provide(drizzleConfigLayer))
const dbLayer = TestDbLayer;

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

const oauthStateLayer = oauthStateCheckerLayer.pipe(Layer.provideMerge(dbLayer))

const radioManagerLayer = RadioManager.layer.pipe(Layer.provideMerge(IcyEncoder.layer))

export const ProductionLayer = Layer.mergeAll(
	dbLayer,
	userRepoLayer,
	sessionLayer,
	oauthRegistryLayer,
	discordProviderLayer,
	githubProviderLayer,
	oauthStateLayer,
	accountLinkLayer,
	authServiceLayer,
	radioManagerLayer,
)
