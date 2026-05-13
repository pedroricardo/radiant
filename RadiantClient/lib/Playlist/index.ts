import { Schema } from "effect"

import * as Id from "../Id"
import * as MediaNode from "../MediaNode"
import * as Radio from "../Radio"

export const idPrefix = "playlist" as const
export const PlaylistId = Id.schema(idPrefix)
export type PlaylistId = typeof PlaylistId.Type

export const PlaylistPlaybackMode = Schema.Literal("linear", "shuffle")
export type PlaylistPlaybackMode = typeof PlaylistPlaybackMode.Type

export const PlaylistItemKind = Schema.Literal("track", "jingle")
export type PlaylistItemKind = typeof PlaylistItemKind.Type

export const Playlist = Schema.Struct({
	id: PlaylistId,
	radioId: Radio.RadioId,
	name: Schema.NonEmptyString,
	description: Schema.NullOr(Schema.String),
	playbackMode: PlaylistPlaybackMode,
	preventImmediateRepeats: Schema.Boolean,
	crossfadeOverrideMs: Schema.NullOr(Schema.Int),
	jingleMinGapTracks: Schema.NullOr(Schema.Int),
	createdAt: Schema.DateTimeUtc,
	updatedAt: Schema.DateTimeUtc,
})

export type Playlist = typeof Playlist.Type

export const playlistItemIdPrefix = "pli" as const
export const PlaylistItemId = Id.schema(playlistItemIdPrefix)
export type PlaylistItemId = typeof PlaylistItemId.Type

export const PlaylistItem = Schema.Struct({
	id: PlaylistItemId,
	playlistId: PlaylistId,
	mediaNodeId: MediaNode.MediaNodeId,
	kind: PlaylistItemKind,
	position: Schema.Int,
	createdAt: Schema.DateTimeUtc,
})

export type PlaylistItem = typeof PlaylistItem.Type
