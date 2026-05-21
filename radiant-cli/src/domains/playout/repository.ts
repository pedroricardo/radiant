import { Array as Arr, Effect, Option, pipe } from "effect"
import * as DateTime from "effect/DateTime"
import { eq } from "drizzle-orm"

import * as Drizzle from "@radiant/backend/services/Drizzle"
import { scheduleOneOffBlocks } from "@radiant/backend/services/Drizzle/schema/scheduleOneOffBlocks"
import { scheduleWeeklyBlocks } from "@radiant/backend/services/Drizzle/schema/scheduleWeeklyBlocks"
import { MediaLibraryService } from "@radiant/backend/services/MediaLibraryService"
import { Id, Playout } from "@radiant/client/lib"

import { makeZonedDateTime } from "../../shared/time"
import type { RadioRow } from "../radios/repository"
import { InsertOneOffBlockError, InsertWeeklyBlockError, OverlappingBlockError } from "./errors"
import type { BlockDraft } from "./types"

type ExistingOneOffBlock = typeof scheduleOneOffBlocks.$inferSelect
type ExistingWeeklyBlock = typeof scheduleWeeklyBlocks.$inferSelect

type MinuteRange = {
	readonly startMinuteOfDay: number
	readonly endMinuteOfDay: number
}

type WeeklySegment = MinuteRange & {
	readonly weekday: number
}

const rangesOverlap = (left: MinuteRange, right: MinuteRange) =>
	left.startMinuteOfDay < right.endMinuteOfDay && right.startMinuteOfDay < left.endMinuteOfDay

const toWeeklySegments = (weekday: number, startMinuteOfDay: number, endMinuteOfDay: number): ReadonlyArray<WeeklySegment> =>
	endMinuteOfDay > startMinuteOfDay
		? [{ weekday, startMinuteOfDay, endMinuteOfDay }]
		: [
				{ weekday, startMinuteOfDay, endMinuteOfDay: 24 * 60 },
				{ weekday: weekday === 7 ? 1 : weekday + 1, startMinuteOfDay: 0, endMinuteOfDay },
			]

const toOneOffWeeklySegments = (
	startsAt: DateTime.Zoned,
	endsAt: DateTime.Zoned,
	timeZone: string,
): ReadonlyArray<WeeklySegment> => {
	const segments: WeeklySegment[] = []
	let cursor = startsAt

	while (DateTime.lessThan(cursor, endsAt)) {
		const parts = DateTime.toParts(cursor)
		const startMinuteOfDay = parts.hours * 60 + parts.minutes
		const nextMidnight = DateTime.unsafeMakeZoned(
			{
				year: parts.year,
				month: parts.month,
				day: parts.day + 1,
				hours: 0,
				minutes: 0,
				seconds: 0,
				millis: 0,
			},
			{
				timeZone,
				adjustForTimeZone: true,
				disambiguation: "compatible",
			},
		)
		const segmentEnd = DateTime.min(endsAt, nextMidnight)
		const endParts = DateTime.toParts(segmentEnd)
		const endMinuteOfDay =
			DateTime.toEpochMillis(segmentEnd) === DateTime.toEpochMillis(nextMidnight)
				? 24 * 60
				: endParts.hours * 60 + endParts.minutes

		segments.push({
			weekday: parts.weekDay,
			startMinuteOfDay,
			endMinuteOfDay,
		})
		cursor = segmentEnd
	}

	return segments
}

const weeklyBlocksOverlap = (
	left: { readonly weekday: number; readonly startMinuteOfDay: number; readonly endMinuteOfDay: number },
	right: { readonly weekday: number; readonly startMinuteOfDay: number; readonly endMinuteOfDay: number },
) =>
	pipe(
		toWeeklySegments(left.weekday, left.startMinuteOfDay, left.endMinuteOfDay),
		Arr.some((leftSegment) =>
			pipe(
				toWeeklySegments(right.weekday, right.startMinuteOfDay, right.endMinuteOfDay),
				Arr.some(
					(rightSegment) =>
						leftSegment.weekday === rightSegment.weekday && rangesOverlap(leftSegment, rightSegment),
				),
			),
		),
	)

const oneOffBlocksOverlap = (
	left: { readonly startsAt: DateTime.Utc; readonly endsAt: DateTime.Utc },
	right: { readonly startsAt: DateTime.Utc; readonly endsAt: DateTime.Utc },
) => DateTime.lessThan(left.startsAt, right.endsAt) && DateTime.lessThan(right.startsAt, left.endsAt)

const weeklyAndOneOffOverlap = (
	weekly: { readonly weekday: number; readonly startMinuteOfDay: number; readonly endMinuteOfDay: number },
	oneOff: { readonly startsAt: DateTime.Utc; readonly endsAt: DateTime.Utc },
	timezone: string,
) =>
	pipe(
		toOneOffWeeklySegments(
			DateTime.setZone(oneOff.startsAt, DateTime.zoneUnsafeMakeNamed(timezone)),
			DateTime.setZone(oneOff.endsAt, DateTime.zoneUnsafeMakeNamed(timezone)),
			timezone,
		),
		Arr.some((oneOffSegment) =>
			pipe(
				toWeeklySegments(weekly.weekday, weekly.startMinuteOfDay, weekly.endMinuteOfDay),
				Arr.some(
					(weeklySegment) =>
						weeklySegment.weekday === oneOffSegment.weekday &&
						rangesOverlap(weeklySegment, oneOffSegment),
				),
			),
		),
	)

const ensureNoOverlap = (
	radio: RadioRow,
	draft: BlockDraft,
	endsAtOption: Option.Option<DateTime.Zoned>,
) =>
	Effect.gen(function* () {
		const db = yield* Drizzle.Drizzle
		const [existingOneOffBlocks, existingWeeklyBlocks] = yield* Effect.all([
			Effect.tryPromise({
				try: () =>
					db.select().from(scheduleOneOffBlocks).where(eq(scheduleOneOffBlocks.radioId, radio.id)),
				catch: (cause) => new InsertOneOffBlockError({ radioId: radio.id, cause }),
			}),
			Effect.tryPromise({
				try: () =>
					db.select().from(scheduleWeeklyBlocks).where(eq(scheduleWeeklyBlocks.radioId, radio.id)),
				catch: (cause) => new InsertWeeklyBlockError({ radioId: radio.id, cause }),
			}),
		])

		if (draft.blockKind === "weekly") {
			const overlapsWeekly = pipe(
				existingWeeklyBlocks,
				Arr.some((existing) =>
					weeklyBlocksOverlap(
						{
							weekday: draft.weekday,
							startMinuteOfDay: draft.startMinuteOfDay,
							endMinuteOfDay: draft.endMinuteOfDay,
						},
						existing,
					),
				),
			)
			const overlapsOneOff = pipe(
				existingOneOffBlocks,
				Arr.some((existing) =>
					weeklyAndOneOffOverlap(
						{
							weekday: draft.weekday,
							startMinuteOfDay: draft.startMinuteOfDay,
							endMinuteOfDay: draft.endMinuteOfDay,
						},
						{
							startsAt: DateTime.unsafeFromDate(new Date(existing.startsAt)),
							endsAt: DateTime.unsafeFromDate(new Date(existing.endsAt)),
						},
						radio.timezone,
					),
				),
			)
			if (overlapsWeekly || overlapsOneOff) {
				return yield* new OverlappingBlockError({ radioId: radio.id })
			}
			return
		}

		if (Option.isNone(endsAtOption)) {
			return
		}

		const startsAtUtc = DateTime.toUtc(draft.startsAt)
		const endsAtUtc = DateTime.toUtc(endsAtOption.value)
		const overlapsOneOff = pipe(
			existingOneOffBlocks,
			Arr.some((existing) =>
				oneOffBlocksOverlap(
					{ startsAt: startsAtUtc, endsAt: endsAtUtc },
					{
						startsAt: DateTime.unsafeFromDate(new Date(existing.startsAt)),
						endsAt: DateTime.unsafeFromDate(new Date(existing.endsAt)),
					},
				),
			),
		)
		const overlapsWeekly = pipe(
			existingWeeklyBlocks,
			Arr.some((existing) =>
				weeklyAndOneOffOverlap(
					existing,
					{ startsAt: startsAtUtc, endsAt: endsAtUtc },
					radio.timezone,
				),
			),
		)
		if (overlapsOneOff || overlapsWeekly) {
			return yield* new OverlappingBlockError({ radioId: radio.id })
		}
	})

export const insertBlock = (radio: RadioRow, draft: BlockDraft) =>
	Effect.gen(function* () {
		const db = yield* Drizzle.Drizzle
		const mediaLibrary = yield* MediaLibraryService
		const now = yield* Effect.map(DateTime.nowAsDate, (date) => date.toISOString())

		if (draft.blockKind === "weekly") {
			const id = Id.random(Playout.scheduleWeeklyBlockIdPrefix)
			const values: typeof scheduleWeeklyBlocks.$inferInsert = {
				id,
				radioId: radio.id,
				weekday: draft.weekday,
				startMinuteOfDay: draft.startMinuteOfDay,
				endMinuteOfDay: draft.endMinuteOfDay,
				targetType: draft.target.targetType,
				playlistId: draft.target.playlistId ?? undefined,
				mediaNodeId: draft.target.mediaNodeId ?? undefined,
				playlistFillMode: draft.playlistFillMode ?? undefined,
				playbackMode: draft.playbackMode,
				createdAt: now,
				updatedAt: now,
			}

			yield* ensureNoOverlap(radio, draft, Option.none())

			yield* Effect.tryPromise({
				try: () => db.insert(scheduleWeeklyBlocks).values(values),
				catch: (cause) => new InsertWeeklyBlockError({ radioId: radio.id, cause }),
			})

			return { id, kind: "weekly" as const }
		}

		const id = Id.random(Playout.scheduleOneOffBlockIdPrefix)
		const startsAt = draft.startsAt
		let endsAt =
			draft.endMinuteOfDay == null
				? startsAt
				: makeZonedDateTime(draft.date, draft.endMinuteOfDay, radio.timezone)

		if (draft.target.targetType === "audio_file") {
			const node = yield* mediaLibrary.getNode({
				radioId: radio.id,
				nodeId: draft.target.mediaNodeId,
			})

			if (node.durationMs == null || node.durationMs <= 0) {
				return yield* new InsertOneOffBlockError({
					radioId: radio.id,
					message: "The selected audio file does not have a valid duration.",
				})
			}

			endsAt = startsAt.pipe(DateTime.addDuration(node.durationMs))
		}

		yield* ensureNoOverlap(radio, draft, Option.some(endsAt))

		const values: typeof scheduleOneOffBlocks.$inferInsert = {
			id,
			radioId: radio.id,
			startsAt: DateTime.toDateUtc(startsAt).toISOString(),
			endsAt: DateTime.toDateUtc(endsAt).toISOString(),
			targetType: draft.target.targetType,
			playlistId: draft.target.playlistId ?? null,
			mediaNodeId: draft.target.mediaNodeId ?? null,
			playlistFillMode: draft.playlistFillMode ?? null,
			playbackMode: draft.playbackMode,
			createdAt: now,
			updatedAt: now,
		}

		yield* Effect.tryPromise({
			try: () => db.insert(scheduleOneOffBlocks).values(values),
			catch: (cause) => new InsertOneOffBlockError({ radioId: radio.id, cause }),
		})

		return { id, kind: "one-off" as const }
	})
