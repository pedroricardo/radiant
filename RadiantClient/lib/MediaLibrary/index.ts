import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

import { Authorization } from "../Auth"
import * as MediaNode from "../MediaNode"
import * as Radio from "../Radio"

const RadioIdParam = HttpApiSchema.param("radioId", Radio.RadioId)
const NodeIdParam = HttpApiSchema.param("nodeId", MediaNode.MediaNodeId)

export class MediaLibraryNodeNotFound extends Schema.TaggedError<MediaLibraryNodeNotFound>()(
	"MediaLibraryNodeNotFound",
	{},
	HttpApiSchema.annotations({ status: 404 }),
) {}

export class MediaLibraryNameConflict extends Schema.TaggedError<MediaLibraryNameConflict>()(
	"MediaLibraryNameConflict",
	{ name: Schema.String },
	HttpApiSchema.annotations({ status: 409 }),
) {}

export class MediaLibraryInvalidMove extends Schema.TaggedError<MediaLibraryInvalidMove>()(
	"MediaLibraryInvalidMove",
	{ message: Schema.String },
	HttpApiSchema.annotations({ status: 400 }),
) {}

export class MediaLibraryInvalidAudioFile extends Schema.TaggedError<MediaLibraryInvalidAudioFile>()(
	"MediaLibraryInvalidAudioFile",
	{ message: Schema.String },
	HttpApiSchema.annotations({ status: 400 }),
) {}

export class MediaLibraryCoverArtNotFound extends Schema.TaggedError<MediaLibraryCoverArtNotFound>()(
	"MediaLibraryCoverArtNotFound",
	{},
	HttpApiSchema.annotations({ status: 404 }),
) {}

export interface MediaLibraryTreeNode {
	readonly id: MediaNode.MediaNodeId
	readonly name: string
	readonly kind: MediaNode.MediaNodeKind
	readonly children: ReadonlyArray<MediaLibraryTreeNode>
}

export const MediaLibraryTreeNode: Schema.Schema<MediaLibraryTreeNode> = Schema.Struct({
	id: MediaNode.MediaNodeId,
	name: Schema.NonEmptyString,
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
	name: Schema.NonEmptyString,
})
export type CreateFolderInput = typeof CreateFolderInput.Type

export const RenameNodeInput = Schema.Struct({
	name: Schema.NonEmptyString,
})
export type RenameNodeInput = typeof RenameNodeInput.Type

export const MoveNodeInput = Schema.Struct({
	parentId: Schema.NullOr(MediaNode.MediaNodeId),
})
export type MoveNodeInput = typeof MoveNodeInput.Type

export const UploadFileUrlParams = Schema.Struct({
	name: Schema.NonEmptyString,
	parentId: Schema.optional(MediaNode.MediaNodeId),
})
export type UploadFileUrlParams = typeof UploadFileUrlParams.Type

export const mediaLibraryGroup = HttpApiGroup.make("mediaLibrary")
	.add(
		HttpApiEndpoint.get("getTree")`/radios/${RadioIdParam}/media-library/tree`
			.addSuccess(Schema.Array(MediaLibraryTreeNode))
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("uploadFile")`/radios/${RadioIdParam}/media-library/files`
			.setUrlParams(UploadFileUrlParams)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFound)
			.addError(MediaLibraryNameConflict)
			.addError(MediaLibraryInvalidMove)
			.addError(MediaLibraryInvalidAudioFile)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.get("getCoverArt")`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}/cover-art`
			.addSuccess(
				Schema.Uint8ArrayFromSelf.pipe(
					HttpApiSchema.withEncoding({
						kind: "Uint8Array",
						contentType: "application/octet-stream",
					}),
				),
			)
			.addError(MediaLibraryNodeNotFound)
			.addError(MediaLibraryCoverArtNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("createFolder")`/radios/${RadioIdParam}/media-library/folders`
			.setPayload(CreateFolderInput)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFound)
			.addError(MediaLibraryNameConflict)
			.addError(MediaLibraryInvalidMove)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.patch("renameNode")`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}/name`
			.setPayload(RenameNodeInput)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFound)
			.addError(MediaLibraryNameConflict)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.patch("moveNode")`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}/parent`
			.setPayload(MoveNodeInput)
			.addSuccess(MediaNode.MediaNode)
			.addError(MediaLibraryNodeNotFound)
			.addError(MediaLibraryNameConflict)
			.addError(MediaLibraryInvalidMove)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.del("deleteNode")`/radios/${RadioIdParam}/media-library/nodes/${NodeIdParam}`
			.addSuccess(Schema.Void)
			.addError(MediaLibraryNodeNotFound)
			.middleware(Authorization),
	)
