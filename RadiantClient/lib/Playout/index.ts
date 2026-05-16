import { Schema } from "effect"

import * as Id from "../Id"
import * as MediaNode from "../MediaNode"
import * as Playlist from "../Playlist"
import * as Radio from "../Radio"
import * as User from "../User"

export const ScheduleTargetType = Schema.Literal("playlist", "audio_file")
export type ScheduleTargetType = typeof ScheduleTargetType.Type

export const BlockPlaybackMode = Schema.Literal("continue", "restart")
export type BlockPlaybackMode = typeof BlockPlaybackMode.Type

export const ModeAfterPlayback = Schema.Literal("overlay")
export type ModeAfterPlayback = typeof ModeAfterPlayback.Type

export const PlaylistFillMode = Schema.Literal("once", "loop")
export type PlaylistFillMode = typeof PlaylistFillMode.Type

export const scheduleWeeklyBlockIdPrefix = "swb" as const
export const ScheduleWeeklyBlockId = Id.schema(scheduleWeeklyBlockIdPrefix)
export type ScheduleWeeklyBlockId = typeof ScheduleWeeklyBlockId.Type

export const ScheduleWeeklyBlock = Schema.Struct({
	id: ScheduleWeeklyBlockId,
	radioId: Radio.RadioId,
	weekday: Schema.Int,
	startMinuteOfDay: Schema.Int,
	endMinuteOfDay: Schema.Int,
	targetType: ScheduleTargetType,
	playlistId: Schema.NullOr(Playlist.PlaylistId),
	mediaNodeId: Schema.NullOr(MediaNode.MediaNodeId),
	playlistFillMode: Schema.NullOr(PlaylistFillMode),
	playbackMode: BlockPlaybackMode,
	modeAfterPlayback: ModeAfterPlayback.pipe(Schema.optionalWith({ default: () => "overlay" })),
	createdAt: Schema.DateTimeUtc,
	updatedAt: Schema.DateTimeUtc,
})

export type ScheduleWeeklyBlock = typeof ScheduleWeeklyBlock.Type
export type ScheduleWeeklyBlockE = typeof ScheduleWeeklyBlock.Encoded

export const scheduleOneOffBlockIdPrefix = "sob" as const
export const ScheduleOneOffBlockId = Id.schema(scheduleOneOffBlockIdPrefix)
export type ScheduleOneOffBlockId = typeof ScheduleOneOffBlockId.Type

export const ScheduleOneOffBlock = Schema.Struct({
	id: ScheduleOneOffBlockId,
	radioId: Radio.RadioId,
	startsAt: Schema.DateTimeUtc,
	endsAt: Schema.DateTimeUtc,
	targetType: ScheduleTargetType,
	playlistId: Schema.NullOr(Playlist.PlaylistId),
	mediaNodeId: Schema.NullOr(MediaNode.MediaNodeId),
	playlistFillMode: Schema.NullOr(PlaylistFillMode),
	playbackMode: BlockPlaybackMode,
	modeAfterPlayback: ModeAfterPlayback.pipe(Schema.optionalWith({ default: () => "overlay" })),
	createdAt: Schema.DateTimeUtc,
	updatedAt: Schema.DateTimeUtc,
})

export type ScheduleOneOffBlock = typeof ScheduleOneOffBlock.Type

export const playoutInterruptionIdPrefix = "interrupt" as const
export const PlayoutInterruptionId = Id.schema(playoutInterruptionIdPrefix)
export type PlayoutInterruptionId = typeof PlayoutInterruptionId.Type

export const PlayoutInterruption = Schema.Struct({
	id: PlayoutInterruptionId,
	radioId: Radio.RadioId,
	mediaNodeId: MediaNode.MediaNodeId,
	startsAt: Schema.DateTimeUtc,
	endsAt: Schema.NullOr(Schema.DateTimeUtc),
	modeAfterPlayback: ModeAfterPlayback,
	createdByUserId: Schema.NullOr(User.UserId),
	note: Schema.NullOr(Schema.String),
	createdAt: Schema.DateTimeUtc,
})

export type PlayoutInterruption = typeof PlayoutInterruption.Type
