import { Schema } from "effect"

import * as Id from "../Id"
import * as Radio from "../Radio"

export const idPrefix = "media" as const
export const MediaNodeId = Id.schema(idPrefix)
export type MediaNodeId = typeof MediaNodeId.Type

export const MediaNodeKind = Schema.Literal("folder", "audio_file")
export type MediaNodeKind = typeof MediaNodeKind.Type

export const MediaNode = Schema.Struct({
	id: MediaNodeId,
	radioId: Radio.RadioId,
	parentId: Schema.NullOr(MediaNodeId),
	kind: MediaNodeKind,
	name: Schema.NonEmptyString,
	storageKey: Schema.NullOr(Schema.String),
	mimeType: Schema.NullOr(Schema.String),
	sizeBytes: Schema.NullOr(
		Schema.Union(Schema.NonNegativeBigInt, Schema.NonNegativeBigIntFromSelf),
	),
	durationMs: Schema.NullOr(Schema.Int),
	containerFormat: Schema.NullOr(Schema.String),
	audioCodec: Schema.NullOr(Schema.String),
	bitrate: Schema.NullOr(Schema.Int),
	title: Schema.NullOr(Schema.String),
	artist: Schema.NullOr(Schema.String),
	album: Schema.NullOr(Schema.String),
	albumArtist: Schema.NullOr(Schema.String),
	genre: Schema.NullOr(Schema.String),
	year: Schema.NullOr(Schema.Int),
	trackNumber: Schema.NullOr(Schema.Int),
	trackTotal: Schema.NullOr(Schema.Int),
	diskNumber: Schema.NullOr(Schema.Int),
	diskTotal: Schema.NullOr(Schema.Int),
	coverArtStorageKey: Schema.NullOr(Schema.String),
	coverArtMimeType: Schema.NullOr(Schema.String),
	sampleRate: Schema.NullOr(Schema.Int),
	channels: Schema.NullOr(Schema.Int),
	fileHash: Schema.NullOr(Schema.String),
	createdAt: Schema.DateTimeUtc,
	updatedAt: Schema.DateTimeUtc,
})

export type MediaNode = typeof MediaNode.Type
