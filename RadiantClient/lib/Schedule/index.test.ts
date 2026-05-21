import { expect, test } from "bun:test"
import { DateTime } from "effect"

import {
	findBlockConflicts,
	projectWeeklyBlockOccurrences,
	resolveCollisionHints,
	type ScheduleBlock,
	type ScheduleOneOffBlock,
	type ScheduleWeeklyBlock,
} from "./index"

const radioId = "radio_test" as const
const weeklyBlockId = "swb_a" as ScheduleWeeklyBlock["id"]
const oneOffBlockId = "sob_a" as ScheduleOneOffBlock["id"]
const mediaNodeId = "media_a" as ScheduleOneOffBlock["target"]["mediaNodeId"]

const weekly = (overrides: Partial<ScheduleWeeklyBlock>): ScheduleWeeklyBlock => ({
	id: weeklyBlockId,
	radioId,
	blockKind: "weekly",
	weekday: 1,
	startMinuteOfDay: 600,
	endMinuteOfDay: 660,
	target: {
		targetType: "audio_file",
		mediaNodeId,
		playlistId: null,
		playlistFillMode: null,
	},
	playbackMode: "continue",
	modeAfterPlayback: "overlay",
	createdAt: DateTime.unsafeFromDate(new Date("2025-01-01T00:00:00Z")),
	updatedAt: DateTime.unsafeFromDate(new Date("2025-01-01T00:00:00Z")),
	...overrides,
})

const oneOff = (overrides: Partial<ScheduleOneOffBlock>): ScheduleOneOffBlock => ({
	id: oneOffBlockId,
	radioId,
	blockKind: "one-off",
	startsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:00:00Z")),
	endsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:30:00Z")),
	target: {
		targetType: "audio_file",
		mediaNodeId,
		playlistId: null,
		playlistFillMode: null,
	},
	playbackMode: "continue",
	modeAfterPlayback: "overlay",
	createdAt: DateTime.unsafeFromDate(new Date("2025-01-01T00:00:00Z")),
	updatedAt: DateTime.unsafeFromDate(new Date("2025-01-01T00:00:00Z")),
	...overrides,
})

test("one-off conflicts with one-off", () => {
	const conflicts = findBlockConflicts(
		[
			oneOff({
				id: "sob_b" as ScheduleOneOffBlock["id"],
				startsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:15:00Z")),
			}) as ScheduleBlock,
		],
		oneOff({}) as ScheduleBlock,
		"UTC",
	)
	expect(conflicts).toHaveLength(1)
	expect(conflicts[0]?.conflictKind).toBe("one-off-one-off")
})

test("weekly cross-midnight conflicts with weekly", () => {
	const conflicts = findBlockConflicts(
		[
			weekly({
				id: "swb_b" as ScheduleWeeklyBlock["id"],
				weekday: 2,
				startMinuteOfDay: 15,
				endMinuteOfDay: 30,
			}) as ScheduleBlock,
		],
		weekly({ weekday: 1, startMinuteOfDay: 23 * 60, endMinuteOfDay: 20 }) as ScheduleBlock,
		"UTC",
	)
	expect(conflicts).toHaveLength(1)
	expect(conflicts[0]?.segments[0]?.weekday).toBe(2)
})

test("one-off conflicts with weekly via timezone projection", () => {
	const conflicts = findBlockConflicts(
		[weekly({}) as ScheduleBlock],
		oneOff({
			startsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:15:00Z")),
			endsAt: DateTime.unsafeFromDate(new Date("2025-01-06T10:45:00Z")),
		}) as ScheduleBlock,
		"UTC",
	)
	expect(conflicts).toHaveLength(1)
	expect(conflicts[0]?.conflictKind).toBe("weekly-one-off")
	expect(resolveCollisionHints(conflicts).length).toBeGreaterThan(0)
})

test("projects weekly occurrences in visible range", () => {
	const occurrences = projectWeeklyBlockOccurrences(
		weekly({}),
		{
			rangeStart: DateTime.unsafeFromDate(new Date("2025-01-06T00:00:00Z")),
			rangeEnd: DateTime.unsafeFromDate(new Date("2025-01-13T00:00:00Z")),
		},
		"UTC",
	)
	expect(occurrences).toHaveLength(1)
	expect(DateTime.toEpochMillis(occurrences[0]!.startsAt)).toBe(
		DateTime.toEpochMillis(DateTime.unsafeFromDate(new Date("2025-01-06T10:00:00Z"))),
	)
})
