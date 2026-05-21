import { Schema } from "effect"

import * as Id from "../Id"
import * as MediaNode from "../MediaNode"
import * as Radio from "../Radio"
import * as Schedule from "../Schedule"
import * as User from "../User"

export const ScheduleTargetType = Schedule.ScheduleTargetType
export type ScheduleTargetType = Schedule.ScheduleTargetType
export const BlockPlaybackMode = Schedule.BlockPlaybackMode
export type BlockPlaybackMode = Schedule.BlockPlaybackMode
export const ModeAfterPlayback = Schedule.ModeAfterPlayback
export type ModeAfterPlayback = Schedule.ModeAfterPlayback
export const PlaylistFillMode = Schedule.PlaylistFillMode
export type PlaylistFillMode = Schedule.PlaylistFillMode
export const scheduleWeeklyBlockIdPrefix = Schedule.scheduleWeeklyBlockIdPrefix
export const ScheduleWeeklyBlockId = Schedule.ScheduleWeeklyBlockId
export type ScheduleWeeklyBlockId = Schedule.ScheduleWeeklyBlockId
export const ScheduleWeeklyBlock = Schedule.ScheduleWeeklyBlock
export type ScheduleWeeklyBlock = Schedule.ScheduleWeeklyBlock
export type ScheduleWeeklyBlockE = typeof ScheduleWeeklyBlock.Encoded
export const scheduleOneOffBlockIdPrefix = Schedule.scheduleOneOffBlockIdPrefix
export const ScheduleOneOffBlockId = Schedule.ScheduleOneOffBlockId
export type ScheduleOneOffBlockId = Schedule.ScheduleOneOffBlockId
export const ScheduleOneOffBlock = Schedule.ScheduleOneOffBlock
export type ScheduleOneOffBlock = Schedule.ScheduleOneOffBlock

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
