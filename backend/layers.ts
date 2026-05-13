import { HttpServer } from "@effect/platform"
import * as Drizzle from "./services/Drizzle"
import { IcyEncoder, RadioManager } from "./services"
import { AuthService } from "./services/AuthService/AuthService"
import * as OAuth from "./services/AuthService/oauth"
import { layerDrizzle as oauthStateCheckerLayer } from "./services/AuthService/oauth"
import * as AccountLinkService from "./services/AuthService/oauth/AccountLinkService"
import * as SessionService from "./services/SessionService"
import * as UserRepository from "./services/UserRepository"
import * as MediaLibraryService from "./services/MediaLibraryService"
import * as MetadataExtractionService from "./services/MetadataExtractionService"
import * as StorageService from "./services/StorageService"
import { Layer } from "effect"

const drizzleConfigLayer = Drizzle.Config.fromConfig
const dbLayer = Drizzle.layer.pipe(Layer.provide(drizzleConfigLayer))
//import { TestDbLayer } from "./test/support/testDb"
//const dbLayer = TestDbLayer;

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

const radioManagerLayer = RadioManager.layer.pipe(
	Layer.provideMerge(IcyEncoder.layer),
	Layer.provideMerge(dbLayer),
)
const storageServiceLayer = StorageService.LocalDiskStorageService.pipe(
	Layer.provideMerge(HttpServer.layerContext),
)
const metadataExtractionServiceLayer = MetadataExtractionService.MusicMetadataExtractionService
const mediaLibraryServiceLayer = MediaLibraryService.DatabaseMediaLibraryService.pipe(
	Layer.provideMerge(dbLayer),
	Layer.provideMerge(metadataExtractionServiceLayer),
	Layer.provideMerge(storageServiceLayer),
)

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
	storageServiceLayer,
	metadataExtractionServiceLayer,
	mediaLibraryServiceLayer,
)
