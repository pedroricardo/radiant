import { Array as Arr, DateTime, Effect, Order, ParseResult, Schema } from "effect"

import { ScheduleBlockService } from "@radiant/backend/services/ScheduleBlockService"
import { Radio, Schedule } from "@radiant/client/lib"

import {
	type LocalDate,
	makeZonedDateTime,
	OneOffStartInput,
	toMinuteOfDay,
	zonedDateParts,
} from "../../shared/time"
import type { RadioRow } from "../radios/repository"
import { NoCurrentBlockForNextError, OverlappingBlockError } from "./errors"
import type { BlockDraft } from "./types"

type ResolvedOneOffStart = typeof OneOffStartInput.Type

type CurrentBlockOccurrence = {
	readonly startsAt: DateTime.Utc
	readonly endsAt: DateTime.Utc
}

const currentBlockOccurrenceOrder = Order.mapInput(
	Order.number,
	(occurrence: CurrentBlockOccurrence) => DateTime.toEpochMillis(occurrence.startsAt),
)

const toResolvedOneOffStart = (
	startsAt: DateTime.Utc,
	timeZone: string,
): ResolvedOneOffStart => {
	const zonedStart = DateTime.setZone(startsAt, DateTime.zoneUnsafeMakeNamed(timeZone))
	const parts = DateTime.toParts(zonedStart)
	const date: LocalDate = zonedDateParts(zonedStart)

	return {
		date,
		startMinuteOfDay: toMinuteOfDay({
			hours: parts.hours,
			minutes: parts.minutes,
		}),
		startsAt: zonedStart,
	}
}

const resolveNextOneOffStart = (radio: RadioRow): Effect.Effect<
	ResolvedOneOffStart,
	NoCurrentBlockForNextError
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError,
	ScheduleBlockService
> =>
	Effect.gen(function* () {
		const scheduleBlockService = yield* ScheduleBlockService
		const now = yield* DateTime.now
		const blocks = yield* scheduleBlockService.listAllBlocks(radio.id)
		const activeWeeklyOccurrences = Schedule.projectWeeklyBlocksOccurrences(
			blocks.weekly,
			{
				rangeStart: DateTime.add(now, { days: -1 }),
				rangeEnd: DateTime.add(now, { days: 1 }),
			},
			radio.timezone,
		)
			.filter(
				(occurrence) =>
					DateTime.lessThanOrEqualTo(occurrence.startsAt, now) &&
					DateTime.lessThan(now, occurrence.endsAt),
			)
			.map((occurrence) => ({
				startsAt: occurrence.startsAt,
				endsAt: occurrence.endsAt,
			}))

		const activeOneOffOccurrences = blocks.oneOff
			.filter(
				(block) =>
					DateTime.lessThanOrEqualTo(block.startsAt, now) && DateTime.lessThan(now, block.endsAt),
			)
			.map((block) => ({
				startsAt: block.startsAt,
				endsAt: block.endsAt,
			}))

		const currentOccurrence = Arr.sort(currentBlockOccurrenceOrder)([
			...activeWeeklyOccurrences,
			...activeOneOffOccurrences,
		]).at(-1)

		if (currentOccurrence == null) {
			return yield* Effect.fail(new NoCurrentBlockForNextError({ radioId: radio.id }))
		}

		return toResolvedOneOffStart(currentOccurrence.endsAt, radio.timezone)
	})

export const resolveOneOffStartInput = (
	radio: RadioRow,
	dateInput: string,
	startInput: string,
): Effect.Effect<
	ResolvedOneOffStart,
	| NoCurrentBlockForNextError
	| ParseResult.ParseError
	| Radio.Errors.RadioManagerDatabaseError
	| Radio.Errors.RadioNotFound
	| Schedule.ScheduleBlockRepositoryError,
	ScheduleBlockService
> =>
	startInput.trim().toLowerCase() === "next"
		? resolveNextOneOffStart(radio)
		: Schema.decodeUnknown(OneOffStartInput)({
				timeZone: radio.timezone,
				dateInput,
				startInput,
			})

const toCreateScheduleBlock = (
	radio: RadioRow,
	draft: BlockDraft,
): Schedule.CreateScheduleBlock => {
	if (draft.blockKind === "weekly") {
		return {
			blockKind: "weekly",
			target:
				draft.target.targetType === "audio_file"
					? {
							targetType: "audio_file",
							mediaNodeId: draft.target.mediaNodeId,
							playlistId: null,
							playlistFillMode: null,
						}
					: {
							targetType: "playlist",
							mediaNodeId: null,
							playlistId: draft.target.playlistId,
							playlistFillMode: draft.playlistFillMode ?? "once",
						},
			playbackMode: draft.playbackMode,
			modeAfterPlayback: "overlay",
			weekday: draft.weekday,
			startMinuteOfDay: draft.startMinuteOfDay,
			endMinuteOfDay: draft.endMinuteOfDay,
		}
	}

	const startsAt = draft.startsAt
	const explicitEnd =
		draft.endMinuteOfDay == null
			? null
			: makeZonedDateTime(draft.date, draft.endMinuteOfDay, radio.timezone)
	const endsAt =
		explicitEnd ??
		makeZonedDateTime(
			draft.date,
			draft.startMinuteOfDay + Math.max(1, Math.ceil((draft.target.durationMs ?? 60_000) / 60_000)),
			radio.timezone,
		)

	return {
		blockKind: "one-off",
		target:
			draft.target.targetType === "audio_file"
				? {
						targetType: "audio_file",
						mediaNodeId: draft.target.mediaNodeId,
						playlistId: null,
						playlistFillMode: null,
					}
				: {
						targetType: "playlist",
						mediaNodeId: null,
						playlistId: draft.target.playlistId,
						playlistFillMode: draft.playlistFillMode ?? "once",
					},
		playbackMode: draft.playbackMode,
		modeAfterPlayback: "overlay",
		startsAt: DateTime.toUtc(startsAt),
		endsAt: DateTime.toUtc(endsAt),
	}
}

export const insertBlock = (radio: RadioRow, draft: BlockDraft) =>
	Effect.gen(function* () {
		const scheduleBlockService = yield* ScheduleBlockService
		const created = yield* scheduleBlockService
			.createBlock(radio.id, toCreateScheduleBlock(radio, draft))
			.pipe(
				Effect.catchTag("ScheduleBlockConflictError", () =>
					Effect.fail(new OverlappingBlockError({ radioId: radio.id })),
				),
			)

		return {
			id: created.id,
			kind: created.blockKind,
		}
	})
