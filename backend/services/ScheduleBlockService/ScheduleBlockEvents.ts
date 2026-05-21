import { Radio, Schedule } from "@radiant/client/lib"
import { Schema } from "effect"

export const scheduleBlocksChangedChannel = "radiant:schedule-blocks:changed" as const

export const ScheduleBlockMutation = Schema.Literal("created", "updated", "deleted")
export type ScheduleBlockMutation = typeof ScheduleBlockMutation.Type

export const ScheduleBlockMutationNotification = Schema.Struct({
	eventType: Schema.Literal("schedule-blocks-changed"),
	radioId: Radio.RadioId,
	blockId: Schema.String,
	mutation: ScheduleBlockMutation,
})
export type ScheduleBlockMutationNotification = typeof ScheduleBlockMutationNotification.Type

export const ScheduleBlockMutationNotificationJson = Schema.parseJson(
	ScheduleBlockMutationNotification,
)
