import { HttpApiBuilder, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import * as RadiantClient from "@radiant/client"
import { Effect } from "effect"

import {
	MediaLibraryInvalidMoveError,
	MediaLibraryNameConflictError,
	MediaLibraryNodeNotFoundError,
	MediaLibraryService,
} from "../services/MediaLibraryService"

export const mediaLibraryGroupLive = HttpApiBuilder.group(
	RadiantClient.ApiContract.httpApi,
	"mediaLibrary",
	(handlers) =>
		handlers
			.handle(
				"getTree",
				Effect.fn("http.mediaLibrary.getTree")(function* ({ path: { radioId } }) {
					const mediaLibrary = yield* MediaLibraryService
					return yield* mediaLibrary.getTree(radioId)
				}, Effect.orDie),
			)
			.handle(
				"uploadFile",
				Effect.fn("http.mediaLibrary.uploadFile")(function* ({
					path: { radioId },
					urlParams,
				}) {
					const mediaLibrary = yield* MediaLibraryService
					const request = yield* HttpServerRequest.HttpServerRequest
					return yield* mediaLibrary
						.uploadAudioFile({
							radioId,
							parentId: urlParams.parentId ?? null,
							name: urlParams.name,
							contentType: request.headers["content-type"],
							content: request.stream,
						})
						.pipe(
							Effect.catchTag(
								"MediaLibraryNodeNotFoundError",
								() => new RadiantClient.MediaLibrary.MediaLibraryNodeNotFound(),
							),
							Effect.catchTag(
								"MediaLibraryNameConflictError",
								(error) => new RadiantClient.MediaLibrary.MediaLibraryNameConflict({ name: error.name }),
							),
							Effect.catchTag(
								"MediaLibraryInvalidMoveError",
								(error) => new RadiantClient.MediaLibrary.MediaLibraryInvalidMove({ message: error.message }),
							),
							Effect.catchTag(
								"MediaLibraryInvalidAudioFileError",
								(error) =>
									new RadiantClient.MediaLibrary.MediaLibraryInvalidAudioFile({
										message: error.message,
									}),
							),
						)
				}, Effect.orDie),
			)
			.handle(
				"getCoverArt",
				Effect.fn("http.mediaLibrary.getCoverArt")(function* ({ path: { radioId, nodeId } }) {
					const mediaLibrary = yield* MediaLibraryService
					const coverArt = yield* mediaLibrary.getCoverArt({ radioId, nodeId }).pipe(
						Effect.catchTag(
							"MediaLibraryNodeNotFoundError",
							() => new RadiantClient.MediaLibrary.MediaLibraryNodeNotFound(),
						),
						Effect.catchTag(
							"MediaLibraryCoverArtNotFoundError",
							() => new RadiantClient.MediaLibrary.MediaLibraryCoverArtNotFound(),
						),
					)

					return HttpServerResponse.stream(coverArt.content, {
						contentType: coverArt.contentType,
						headers: {
							"cache-control": "public, max-age=3600",
						},
					})
				}, Effect.orDie),
			)
			.handle(
				"createFolder",
				Effect.fn("http.mediaLibrary.createFolder")(function* ({
					path: { radioId },
					payload,
				}) {
					const mediaLibrary = yield* MediaLibraryService
					return yield* mediaLibrary.createFolder({
						radioId,
						parentId: payload.parentId,
						name: payload.name,
					}).pipe(
						Effect.catchTag(
							"MediaLibraryNodeNotFoundError",
							() => new RadiantClient.MediaLibrary.MediaLibraryNodeNotFound(),
						),
						Effect.catchTag(
							"MediaLibraryNameConflictError",
							(error) => new RadiantClient.MediaLibrary.MediaLibraryNameConflict({ name: error.name }),
						),
						Effect.catchTag(
							"MediaLibraryInvalidMoveError",
							(error) => new RadiantClient.MediaLibrary.MediaLibraryInvalidMove({ message: error.message }),
						),
					)
				}, Effect.orDie),
			)
			.handle(
				"renameNode",
				Effect.fn("http.mediaLibrary.renameNode")(function* ({
					path: { radioId, nodeId },
					payload,
				}) {
					const mediaLibrary = yield* MediaLibraryService
					return yield* mediaLibrary.renameNode({
						radioId,
						nodeId,
						name: payload.name,
					}).pipe(
						Effect.catchTag(
							"MediaLibraryNodeNotFoundError",
							() => new RadiantClient.MediaLibrary.MediaLibraryNodeNotFound(),
						),
						Effect.catchTag(
							"MediaLibraryNameConflictError",
							(error) => new RadiantClient.MediaLibrary.MediaLibraryNameConflict({ name: error.name }),
						),
					)
				}, Effect.orDie),
			)
			.handle(
				"moveNode",
				Effect.fn("http.mediaLibrary.moveNode")(function* ({
					path: { radioId, nodeId },
					payload,
				}) {
					const mediaLibrary = yield* MediaLibraryService
					return yield* mediaLibrary.moveNode({
						radioId,
						nodeId,
						parentId: payload.parentId,
					}).pipe(
						Effect.catchTag(
							"MediaLibraryNodeNotFoundError",
							() => new RadiantClient.MediaLibrary.MediaLibraryNodeNotFound(),
						),
						Effect.catchTag(
							"MediaLibraryNameConflictError",
							(error) => new RadiantClient.MediaLibrary.MediaLibraryNameConflict({ name: error.name }),
						),
						Effect.catchTag(
							"MediaLibraryInvalidMoveError",
							(error) => new RadiantClient.MediaLibrary.MediaLibraryInvalidMove({ message: error.message }),
						),
					)
				}, Effect.orDie),
			)
			.handle(
				"deleteNode",
				Effect.fn("http.mediaLibrary.deleteNode")(function* ({ path: { radioId, nodeId } }) {
					const mediaLibrary = yield* MediaLibraryService
					return yield* mediaLibrary.deleteNode({
						radioId,
						nodeId,
					}).pipe(
						Effect.catchTag(
							"MediaLibraryNodeNotFoundError",
							() => new RadiantClient.MediaLibrary.MediaLibraryNodeNotFound(),
						),
					)
				}, Effect.orDie),
			),
)
