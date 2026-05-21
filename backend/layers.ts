import * as Otlp from "@effect/opentelemetry/Otlp"
import { FetchHttpClient } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { Layer, Logger, LogLevel } from "effect"
import { IcyEncoder, PlayoutManager, RadioManager } from "./services"
import { AuthService } from "./services/AuthService/AuthService"
import * as OAuth from "./services/AuthService/oauth"
import { layerDrizzle as oauthStateCheckerLayer } from "./services/AuthService/oauth"
import * as AccountLinkService from "./services/AuthService/oauth/AccountLinkService"
import * as Drizzle from "./services/Drizzle"
import * as MediaLibraryService from "./services/MediaLibraryService"
import * as MetadataExtractionService from "./services/MetadataExtractionService"
import * as RedisService from "./services/RedisService"
import {
	ScheduleBlockRepositoryLive,
	ScheduleBlockServiceLive,
} from "./services/ScheduleBlockService"
import * as SessionService from "./services/SessionService"
import * as StorageService from "./services/StorageService"
import * as UserRepository from "./services/UserRepository"

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

const storageServiceLayer = StorageService.LocalDiskStorageService
const redisServiceConfigLayer = RedisService.Config.fromConfig
const bunRedisClientLayer = RedisService.BunRedisClient.layer.pipe(
	Layer.provide(redisServiceConfigLayer),
)
const redisStorageLayer = RedisService.RedisStorage.layerBun.pipe(
	Layer.provide(bunRedisClientLayer),
)
const redisPubSubLayer = RedisService.RedisPubSub.layerBun.pipe(
	Layer.provide(bunRedisClientLayer),
)
const metadataExtractionServiceLayer = MetadataExtractionService.MusicMetadataExtractionService
const mediaLibraryServiceLayer = MediaLibraryService.DatabaseMediaLibraryService.pipe(
	Layer.provideMerge(dbLayer),
	Layer.provideMerge(metadataExtractionServiceLayer),
	Layer.provideMerge(storageServiceLayer),
)
const radioRepositoryLayer = RadioManager.RadioRepository.Default.pipe(Layer.provideMerge(dbLayer))
const scheduleBlockRepositoryLayer = ScheduleBlockRepositoryLive.pipe(Layer.provideMerge(dbLayer))
const scheduleBlockServiceLayer = ScheduleBlockServiceLive.pipe(
	Layer.provideMerge(scheduleBlockRepositoryLayer),
	Layer.provideMerge(radioRepositoryLayer),
)

const radioManagerLayer = RadioManager.layer.pipe(
	Layer.provideMerge(IcyEncoder.layer),
	Layer.provideMerge(PlayoutManager.layer),
	Layer.provideMerge(scheduleBlockServiceLayer),
	Layer.provideMerge(radioRepositoryLayer),
	Layer.provideMerge(dbLayer),
	Layer.provideMerge(mediaLibraryServiceLayer),
)

const otelBaseUrl = process.env.RADIANT_OTEL_BASE_URL
const effectLogLevel = (() => {
	switch (process.env.EFFECT_LOG?.trim().toLowerCase()) {
		case undefined:
		case "":
			return LogLevel.Info
		case "all":
			return LogLevel.All
		case "trace":
			return LogLevel.Trace
		case "debug":
			return LogLevel.Debug
		case "info":
			return LogLevel.Info
		case "warn":
		case "warning":
			return LogLevel.Warning
		case "error":
			return LogLevel.Error
		case "fatal":
			return LogLevel.Fatal
		case "none":
		case "off":
			return LogLevel.None
		default:
			return LogLevel.Info
	}
})()
const otelHeaders = process.env.RADIANT_OTEL_HEADERS
	? (JSON.parse(process.env.RADIANT_OTEL_HEADERS) as Record<string, string>)
	: undefined
const otelExportIntervalMs = process.env.RADIANT_OTEL_EXPORT_INTERVAL_MS
	? Number(process.env.RADIANT_OTEL_EXPORT_INTERVAL_MS)
	: undefined

const observabilityLive =
	otelBaseUrl == null || otelBaseUrl.length === 0
		? Layer.empty
		: Otlp.layerJson({
				baseUrl: otelBaseUrl,
				headers: otelHeaders,
				resource: {
					serviceName: process.env.RADIANT_OTEL_SERVICE_NAME ?? "radiant-backend",
					serviceVersion: process.env.RADIANT_OTEL_SERVICE_VERSION,
					attributes: {
						"deployment.environment": process.env.NODE_ENV ?? "development",
					},
				},
				tracerExportInterval:
					otelExportIntervalMs == null ? "1 seconds" : `${otelExportIntervalMs} millis`,
				metricsExportInterval:
					otelExportIntervalMs == null ? "5 seconds" : `${otelExportIntervalMs} millis`,
				loggerExportInterval:
					otelExportIntervalMs == null ? "1 seconds" : `${otelExportIntervalMs} millis`,
				loggerExcludeLogSpans: false,
				shutdownTimeout: "3 seconds",
			}).pipe(Layer.provideMerge(FetchHttpClient.layer))

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
	scheduleBlockRepositoryLayer,
	scheduleBlockServiceLayer,
	redisStorageLayer,
	redisPubSubLayer,
	storageServiceLayer,
	metadataExtractionServiceLayer,
	mediaLibraryServiceLayer,
).pipe(
	Layer.provideMerge(BunContext.layer),
	Layer.provideMerge(observabilityLive),
	Layer.provideMerge(Logger.pretty),
	Layer.provideMerge(Logger.minimumLogLevel(effectLogLevel)),
)
