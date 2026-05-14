import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

import { Authorization } from "../Auth"
import * as MediaNode from "../MediaNode"
import * as Radio from "../Radio"

const RadioIdParam = HttpApiSchema.param("radioId", Radio.RadioId)
const NodeIdParam = HttpApiSchema.param("nodeId", MediaNode.MediaNodeId)

import { RadioManagerDatabaseError, RadioNotFound } from "../Radio/errors"

const MediaLibraryNodeName = Schema.NonEmptyString.pipe(Schema.maxLength(255))

export class MediaLibraryServiceError extends Schema.TaggedError<MediaLibraryServiceError>()(
	"MediaLibraryServiceError",
	{
		cause: Schema.Unknown,
		message: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 500,
	}),
) {}

export class MediaLibraryNodeNotFoundError extends Schema.TaggedError<MediaLibraryNodeNotFoundError>()(
	"MediaLibraryNodeNotFoundError",
	{
		radioId: Radio.RadioId,
		nodeId: MediaNode.MediaNodeId,
	},
	HttpApiSchema.annotations({
		status: 404,
	}),
) {}

export class MediaLibraryNameConflictError extends Schema.TaggedError<MediaLibraryNameConflictError>()(
	"MediaLibraryNameConflictError",
	{
		name: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 409,
	}),
) {}

export class MediaLibraryInvalidMoveError extends Schema.TaggedError<MediaLibraryInvalidMoveError>()(
	"MediaLibraryInvalidMoveError",
	{
		message: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 400,
	}),
) {}

export class MediaLibraryInvalidAudioFileError extends Schema.TaggedError<MediaLibraryInvalidAudioFileError>()(
	"MediaLibraryInvalidAudioFileError",
	{
		message: Schema.String,
	},
	HttpApiSchema.annotations({
		status: 400,
	}),
) {}

export class MediaLibraryStorageQuotaExceededError extends Schema.TaggedError<MediaLibraryStorageQuotaExceededError>()(
	"MediaLibraryStorageQuotaExceededError",
	{
		quotaBytes: Schema.BigInt,
		usedBytes: Schema.BigInt,
		attemptedBytes: Schema.BigInt,
	},
	HttpApiSchema.annotations({
		status: 413,
	}),
) {}

export class MediaLibraryCoverArtNotFoundError extends Schema.TaggedError<MediaLibraryCoverArtNotFoundError>()(
	"MediaLibraryCoverArtNotFoundError",
	{
		radioId: Radio.RadioId,
		nodeId: MediaNode.MediaNodeId,
	},
	HttpApiSchema.annotations({
		status: 404,
	}),
) {}

export interface MediaLibraryTreeNode {
	readonly id: MediaNode.MediaNodeId
	readonly name: string
	readonly kind: MediaNode.MediaNodeKind
	readonly children: ReadonlyArray<MediaLibraryTreeNode>
}

export const MediaLibraryTreeNode: Schema.Schema<MediaLibraryTreeNode> = Schema.Struct({
	id: MediaNode.MediaNodeId,
	name: MediaLibraryNodeName,
	kind: MediaNode.MediaNodeKind,
	children: Schema.Array(
		Schema.suspend((): Schema.Schema<MediaLibraryTreeNode> => MediaLibraryTreeNode).annotations({
			identifier: "RadiantMediaLibraryTreeNode",
			title: "Radiant Media Library Tree Node",
		}),
	),
})

export const CreateFolderInput = Schema.Struct({
	parentId: Schema.NullOr(MediaNode.MediaNodeId),
	name: MediaLibraryNodeName,
})
export type CreateFolderInput = typeof CreateFolderInput.Type

export const RenameNodeInput = Schema.Struct({
	name: MediaLibraryNodeName,
})
export type RenameNodeInput = typeof RenameNodeInput.Type

export const MoveNodeInput = Schema.Struct({
	parentId: Schema.NullOr(MediaNode.MediaNodeId),
})
export type MoveNodeInput = typeof MoveNodeInput.Type

export const UploadFileUrlParams = Schema.Struct({
	name: MediaLibraryNodeName,
	parentId: Schema.optional(MediaNode.MediaNodeId),
})
export type UploadFileUrlParams = typeof UploadFileUrlParams.Type

export const mediaLibraryGroup = HttpApiGroup.make("mediaLibrary")
	.add(
		HttpApiEndpoint.get("getTree")`/radios/${RadioIdParam}/media-library/tree`
			.addSuccess(Schema.Array(MediaLibraryTreeNode))
			.addError(MediaLibraryServiceError)
			.addError(RadioManagerDatabaseError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("uploadFile")`/radios/${RadioIdParam}/media-library/files`
			.setUrlParams(UploadFileUrlParams)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFoundError)
			.addError(MediaLibraryNameConflictError)
			.addError(MediaLibraryInvalidMoveError)
			.addError(MediaLibraryInvalidAudioFileError)
			.addError(MediaLibraryStorageQuotaExceededError)
			.addError(MediaLibraryServiceError)
			.addError(RadioManagerDatabaseError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.get(
			"getCoverArt",
		)`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}/cover-art`
			.addSuccess(
				Schema.Uint8ArrayFromSelf.pipe(
					HttpApiSchema.withEncoding({
						kind: "Uint8Array",
						contentType: "application/octet-stream",
					}),
				),
			)
			.addError(MediaLibraryNodeNotFoundError)
			.addError(MediaLibraryCoverArtNotFoundError)
			.addError(MediaLibraryServiceError)
			.addError(RadioManagerDatabaseError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("createFolder")`/radios/${RadioIdParam}/media-library/folders`
			.setPayload(CreateFolderInput)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryServiceError)
			.addError(MediaLibraryNodeNotFoundError)
			.addError(MediaLibraryNameConflictError)
			.addError(MediaLibraryInvalidMoveError)
			.addError(RadioManagerDatabaseError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.patch(
			"renameNode",
		)`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}/name`
			.setPayload(RenameNodeInput)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFoundError)
			.addError(MediaLibraryNameConflictError)
			.addError(MediaLibraryServiceError)
			.addError(RadioManagerDatabaseError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.patch(
			"moveNode",
		)`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}/parent`
			.setPayload(MoveNodeInput)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFoundError)
			.addError(MediaLibraryNameConflictError)
			.addError(MediaLibraryInvalidMoveError)
			.addError(RadioManagerDatabaseError)
			.addError(MediaLibraryServiceError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.del("deleteNode")`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}`
			.addSuccess(Schema.Void)
			.addError(MediaLibraryNodeNotFoundError)
			.addError(MediaLibraryServiceError)
			.addError(RadioManagerDatabaseError)
			.addError(RadioNotFound)
			.middleware(Authorization),
	)
