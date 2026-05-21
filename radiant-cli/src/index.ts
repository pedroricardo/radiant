import { Command } from "@effect/cli"
import { BunContext, BunFileSystem, BunPath } from "@effect/platform-bun"
import { Effect, Layer } from "effect"

import * as Drizzle from "@radiant/backend/services/Drizzle"
import * as MediaLibraryService from "@radiant/backend/services/MediaLibraryService"
import * as MetadataExtractionService from "@radiant/backend/services/MetadataExtractionService"
import * as RadioManager from "@radiant/backend/services/RadioManager"
import * as RedisService from "@radiant/backend/services/RedisService"
import {
	ScheduleBlockRepositoryLive,
	ScheduleBlockServiceLive,
} from "@radiant/backend/services/ScheduleBlockService"
import * as StorageService from "@radiant/backend/services/StorageService"
import {
	MediaLibraryInvalidAudioFileError,
	MediaLibraryNameConflictError,
	MediaLibraryNodeNotFoundError,
	MediaLibraryServiceError,
	MediaLibraryStorageQuotaExceededError,
} from "@radiant/client/lib/MediaLibrary"

import { rootCommand } from "./cli"
import {
	InvalidLocalAudioFileError,
	ReadLocalDirectoryError,
	ReadLocalFileInfoError,
} from "./domains/local-filesystem/errors"
import { FetchAudioNodesError, NoAudioNodesForRadioError } from "./domains/media-library/errors"
import { FetchPlaylistsError, NoPlaylistsForRadioError } from "./domains/playlists/errors"
import { FetchRadiosError, RadioSelectionNotFoundError } from "./domains/radios/errors"
import * as Prompter from "./shared/Prompter"
import { PromptCanceledError, PromptExecutionError } from "./shared/Prompter"
import { clackLoggerLayer } from "./shared/logger"

const drizzleLayer = Drizzle.layer.pipe(Layer.provide(Drizzle.Config.fromConfig))
const redisConfigLayer = RedisService.Config.fromConfig
const bunRedisClientLayer = RedisService.BunRedisClient.layer.pipe(
	Layer.provideMerge(redisConfigLayer),
)
const redisPubSubLayer = RedisService.RedisPubSub.layerBun.pipe(
	Layer.provideMerge(bunRedisClientLayer),
)
const storageLayer = StorageService.LocalDiskStorageService
const metadataExtractionLayer = MetadataExtractionService.MusicMetadataExtractionService
const mediaLibraryLayer = MediaLibraryService.DatabaseMediaLibraryService.pipe(
	Layer.provideMerge(drizzleLayer),
	Layer.provideMerge(storageLayer),
	Layer.provideMerge(metadataExtractionLayer),
)
const radioRepositoryLayer = RadioManager.RadioRepository.Default.pipe(
	Layer.provideMerge(drizzleLayer),
)
const scheduleBlockRepositoryLayer = ScheduleBlockRepositoryLive.pipe(
	Layer.provideMerge(drizzleLayer),
)
const scheduleBlockServiceLayer = ScheduleBlockServiceLive.pipe(
	Layer.provideMerge(scheduleBlockRepositoryLayer),
	Layer.provideMerge(radioRepositoryLayer),
	Layer.provideMerge(redisPubSubLayer),
)

const run = rootCommand.pipe(
	Command.run({
		name: "Radiant CLI",
		version: "0.0.0",
	}),
)

const logKnownCliError = (error: unknown) => {
	if (error instanceof PromptCanceledError) {
		return Effect.logInfo(error.message)
	}
	if (error instanceof PromptExecutionError) {
		return Effect.logError(error.message)
	}
	if (error instanceof FetchRadiosError) {
		return Effect.logError(error.message)
	}
	if (error instanceof RadioSelectionNotFoundError) {
		return Effect.logError(error.message)
	}
	if (error instanceof FetchPlaylistsError) {
		return Effect.logError(error.message)
	}
	if (error instanceof NoPlaylistsForRadioError) {
		return Effect.logWarning(error.message)
	}
	if (error instanceof FetchAudioNodesError) {
		return Effect.logError(error.message)
	}
	if (error instanceof NoAudioNodesForRadioError) {
		return Effect.logWarning(error.message)
	}
	if (error instanceof ReadLocalDirectoryError) {
		return Effect.logError(error.message)
	}
	if (error instanceof ReadLocalFileInfoError) {
		return Effect.logError(error.message)
	}
	if (error instanceof InvalidLocalAudioFileError) {
		return Effect.logWarning(error.message)
	}
	if (error instanceof MediaLibraryNodeNotFoundError) {
		return Effect.logError("The selected media library destination no longer exists.")
	}
	if (error instanceof MediaLibraryNameConflictError) {
		return Effect.logError(`A media library item named "${error.name}" already exists there.`)
	}
	if (error instanceof MediaLibraryInvalidAudioFileError) {
		return Effect.logError(error.message)
	}
	if (error instanceof MediaLibraryStorageQuotaExceededError) {
		return Effect.logError("The upload would exceed this user's storage quota.")
	}
	if (error instanceof MediaLibraryServiceError) {
		return Effect.logError(error.message)
	}

	return Effect.logFatal(error)
}
const cliLayer = mediaLibraryLayer.pipe(
	Layer.provideMerge(radioRepositoryLayer),
	Layer.provideMerge(scheduleBlockRepositoryLayer),
	Layer.provideMerge(scheduleBlockServiceLayer),
	Layer.provideMerge(Prompter.clack),
	Layer.provideMerge(clackLoggerLayer),
	Layer.provideMerge(BunContext.layer),
	Layer.provideMerge(BunFileSystem.layer),
	Layer.provideMerge(BunPath.layer),
)
const program = run(process.argv).pipe(Effect.catchAll(logKnownCliError), Effect.provide(cliLayer))

await Effect.runPromise(program)
