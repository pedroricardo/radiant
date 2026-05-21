import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Array as Arr, DateTime, Order, Schema, pipe } from "effect"

import { Authorization } from "../Auth"
import * as Id from "../Id"
import * as MediaNode from "../MediaNode"
import * as Playlist from "../Playlist"
import * as Radio from "../Radio"
import * as RadioErrors from "../Radio/errors"

export const ScheduleTargetType = Schema.Literal("playlist", "audio_file")
export type ScheduleTargetType = typeof ScheduleTargetType.Type

export const BlockPlaybackMode = Schema.Literal("continue", "restart")
export type BlockPlaybackMode = typeof BlockPlaybackMode.Type

export const ModeAfterPlayback = Schema.Literal("overlay")
export type ModeAfterPlayback = typeof ModeAfterPlayback.Type

export const PlaylistFillMode = Schema.Literal("once", "loop")
export type PlaylistFillMode = typeof PlaylistFillMode.Type

export const ScheduleTarget = Schema.Union(
	Schema.Struct({
		targetType: Schema.Literal("playlist"),
		playlistId: Playlist.PlaylistId,
		mediaNodeId: Schema.Null,
		playlistFillMode: PlaylistFillMode,
	}),
	Schema.Struct({
		targetType: Schema.Literal("audio_file"),
		playlistId: Schema.Null,
		mediaNodeId: MediaNode.MediaNodeId,
		playlistFillMode: Schema.Null,
	}),
)
export type ScheduleTarget = typeof ScheduleTarget.Type

export const scheduleWeeklyBlockIdPrefix = "swb" as const
export const ScheduleWeeklyBlockId = Id.schema(scheduleWeeklyBlockIdPrefix)
export type ScheduleWeeklyBlockId = typeof ScheduleWeeklyBlockId.Type

export const scheduleOneOffBlockIdPrefix = "sob" as const
export const ScheduleOneOffBlockId = Id.schema(scheduleOneOffBlockIdPrefix)
export type ScheduleOneOffBlockId = typeof ScheduleOneOffBlockId.Type

export const Weekday = Schema.Int.pipe(Schema.between(1, 7))
export type Weekday = typeof Weekday.Type

export const MinuteOfDay = Schema.Int.pipe(Schema.between(0, 24 * 60))
export type MinuteOfDay = typeof MinuteOfDay.Type

export const WeeklyTiming = Schema.Struct({
	weekday: Weekday,
	startMinuteOfDay: MinuteOfDay,
	endMinuteOfDay: MinuteOfDay,
})
export type WeeklyTiming = typeof WeeklyTiming.Type

export const OneOffTiming = Schema.Struct({
	startsAt: Schema.DateTimeUtc,
	endsAt: Schema.DateTimeUtc,
})
export type OneOffTiming = typeof OneOffTiming.Type

const ScheduleBlockMetadata = {
	radioId: Radio.RadioId,
	playbackMode: BlockPlaybackMode,
	modeAfterPlayback: ModeAfterPlayback.pipe(Schema.optionalWith({ default: () => "overlay" })),
	createdAt: Schema.DateTimeUtc,
	updatedAt: Schema.DateTimeUtc,
}

export const ScheduleWeeklyBlock = Schema.Struct({
	id: ScheduleWeeklyBlockId,
	...ScheduleBlockMetadata,
	target: ScheduleTarget,
	...WeeklyTiming.fields,
})
export type ScheduleWeeklyBlock = typeof ScheduleWeeklyBlock.Type

export const ScheduleOneOffBlock = Schema.Struct({
	id: ScheduleOneOffBlockId,
	...ScheduleBlockMetadata,
	target: ScheduleTarget,
	...OneOffTiming.fields,
})
export type ScheduleOneOffBlock = typeof ScheduleOneOffBlock.Type

export const ScheduleBlock = Schema.Union(
	ScheduleWeeklyBlock.pipe(Schema.attachPropertySignature("blockKind", "weekly")),
	ScheduleOneOffBlock.pipe(Schema.attachPropertySignature("blockKind", "one-off")),
)
export type ScheduleBlock = typeof ScheduleBlock.Type

export const CreateWeeklyBlock = Schema.Struct({
	target: ScheduleTarget,
	playbackMode: BlockPlaybackMode,
	modeAfterPlayback: ModeAfterPlayback.pipe(Schema.optionalWith({ default: () => "overlay" })),
	...WeeklyTiming.fields,
})
export type CreateWeeklyBlock = typeof CreateWeeklyBlock.Type

export const CreateOneOffBlock = Schema.Struct({
	target: ScheduleTarget,
	playbackMode: BlockPlaybackMode,
	modeAfterPlayback: ModeAfterPlayback.pipe(Schema.optionalWith({ default: () => "overlay" })),
	...OneOffTiming.fields,
})
export type CreateOneOffBlock = typeof CreateOneOffBlock.Type

export const CreateScheduleBlock = Schema.Union(
	CreateWeeklyBlock.pipe(Schema.attachPropertySignature("blockKind", "weekly")),
	CreateOneOffBlock.pipe(Schema.attachPropertySignature("blockKind", "one-off")),
)
export type CreateScheduleBlock = typeof CreateScheduleBlock.Type

export const UpdateWeeklyBlock = Schema.Struct({
	target: Schema.optional(ScheduleTarget),
	playbackMode: Schema.optional(BlockPlaybackMode),
	modeAfterPlayback: Schema.optional(ModeAfterPlayback),
	weekday: Schema.optional(Weekday),
	startMinuteOfDay: Schema.optional(MinuteOfDay),
	endMinuteOfDay: Schema.optional(MinuteOfDay),
})
export type UpdateWeeklyBlock = typeof UpdateWeeklyBlock.Type
export const UpdateOneOffBlock = Schema.Struct({
	target: Schema.optional(ScheduleTarget),
	playbackMode: Schema.optional(BlockPlaybackMode),
	modeAfterPlayback: Schema.optional(ModeAfterPlayback),
	startsAt: Schema.optional(Schema.DateTimeUtc),
	endsAt: Schema.optional(Schema.DateTimeUtc),
})
export type UpdateOneOffBlock = typeof UpdateOneOffBlock.Type
export const UpdateScheduleBlock = Schema.Union(
	UpdateWeeklyBlock.pipe(Schema.attachPropertySignature("blockKind", "weekly")),
	UpdateOneOffBlock.pipe(Schema.attachPropertySignature("blockKind", "one-off")),
)
export type UpdateScheduleBlock = typeof UpdateScheduleBlock.Type

export const ScheduleVisibleRange = Schema.Struct({
	rangeStart: Schema.DateTimeUtc,
	rangeEnd: Schema.DateTimeUtc,
})
export type ScheduleVisibleRange = typeof ScheduleVisibleRange.Type

export const ScheduleBlocksQuery = Schema.Struct({
	rangeStart: Schema.DateTimeUtc,
	rangeEnd: Schema.DateTimeUtc,
	oneOffCursor: Schema.optional(Schema.String),
	oneOffLimit: Schema.optional(
		Schema.Int.pipe(Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
	),
})
export type ScheduleBlocksQuery = typeof ScheduleBlocksQuery.Type

export const ScheduleBlocksUrlParams = Schema.Struct({
	rangeStart: Schema.String,
	rangeEnd: Schema.String,
	oneOffCursor: Schema.optional(Schema.String),
	oneOffLimit: Schema.optional(Schema.String),
})
export type ScheduleBlocksUrlParams = typeof ScheduleBlocksUrlParams.Type

export const WeeklyOccurrence = Schema.Struct({
	blockId: ScheduleWeeklyBlockId,
	weekday: Weekday,
	startMinuteOfDay: MinuteOfDay,
	endMinuteOfDay: MinuteOfDay,
	startsAt: Schema.DateTimeUtc,
	endsAt: Schema.DateTimeUtc,
})
export type WeeklyOccurrence = typeof WeeklyOccurrence.Type

export const ScheduleSegment = Schema.Struct({
	weekday: Weekday,
	startMinuteOfDay: MinuteOfDay,
	endMinuteOfDay: MinuteOfDay,
})
export type ScheduleSegment = typeof ScheduleSegment.Type

export const ScheduleOverlapRange = Schema.Struct({
	startsAt: Schema.DateTimeUtc,
	endsAt: Schema.DateTimeUtc,
})
export type ScheduleOverlapRange = typeof ScheduleOverlapRange.Type

export const CollisionDirection = Schema.Literal("backward", "forward")
export type CollisionDirection = typeof CollisionDirection.Type

export const CollisionHint = Schema.Struct({
	direction: CollisionDirection,
	anchorMinuteOfDay: MinuteOfDay,
	targetMinuteOfDay: MinuteOfDay,
})
export type CollisionHint = typeof CollisionHint.Type

export const ConflictKind = Schema.Literal("weekly-weekly", "one-off-one-off", "weekly-one-off")
export type ConflictKind = typeof ConflictKind.Type

export const ScheduleBlockConflict = Schema.Struct({
	candidateBlockId: Schema.NullOr(Schema.String),
	existingBlockId: Schema.String,
	conflictKind: ConflictKind,
	overlapRange: Schema.NullOr(ScheduleOverlapRange),
	segments: Schema.Array(ScheduleSegment),
	hints: Schema.Array(CollisionHint),
})
export type ScheduleBlockConflict = typeof ScheduleBlockConflict.Type

export class ScheduleBlockConflictError extends Schema.TaggedError<ScheduleBlockConflictError>()(
	"ScheduleBlockConflictError",
	{
		radioId: Radio.RadioId,
		conflicts: Schema.Array(ScheduleBlockConflict),
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "The schedule block overlaps an existing block."),
		),
	},
) {}

export class ScheduleBlockRepositoryError extends Schema.TaggedError<ScheduleBlockRepositoryError>()(
	"ScheduleBlockRepositoryError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
	HttpApiSchema.annotations({ status: 500 }),
) {}

export class ScheduleBlockNotFoundError extends Schema.TaggedError<ScheduleBlockNotFoundError>()(
	"ScheduleBlockNotFoundError",
	{
		blockId: Schema.String,
		message: Schema.String.pipe(
			Schema.propertySignature,
			Schema.withConstructorDefault(() => "Schedule block not found."),
		),
	},
	HttpApiSchema.annotations({ status: 404 }),
) {}

export const ValidateScheduleBlockResponse = Schema.Struct({
	ok: Schema.Boolean,
	conflicts: Schema.Array(ScheduleBlockConflict),
	weeklyOccurrences: Schema.Array(WeeklyOccurrence),
})
export type ValidateScheduleBlockResponse = typeof ValidateScheduleBlockResponse.Type

export const ScheduleBlocksResponse = Schema.Struct({
	weekly: Schema.Struct({
		rules: Schema.Array(ScheduleWeeklyBlock),
		occurrences: Schema.Array(WeeklyOccurrence),
	}),
	oneOff: Schema.Struct({
		items: Schema.Array(ScheduleOneOffBlock),
		pageInfo: Schema.Struct({
			cursor: Schema.NullOr(Schema.String),
			hasMore: Schema.Boolean,
		}),
	}),
})
export type ScheduleBlocksResponse = typeof ScheduleBlocksResponse.Type

const RadioIdParam = HttpApiSchema.param("radioId", Radio.RadioId)
const BlockIdParam = HttpApiSchema.param("blockId", Schema.String)

export const scheduleBlocksGroup = HttpApiGroup.make("scheduleBlocks")
	.add(
		HttpApiEndpoint.get("listBlocks")`/radios/${RadioIdParam}/schedule/blocks`
			.setUrlParams(ScheduleBlocksUrlParams)
			.addSuccess(ScheduleBlocksResponse)
			.addError(ScheduleBlockConflictError)
			.addError(ScheduleBlockRepositoryError)
			.addError(RadioErrors.RadioManagerDatabaseError)
			.addError(RadioErrors.RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("createBlock")`/radios/${RadioIdParam}/schedule/blocks`
			.setPayload(CreateScheduleBlock)
			.addSuccess(ScheduleBlock)
			.addError(ScheduleBlockConflictError)
			.addError(ScheduleBlockRepositoryError)
			.addError(RadioErrors.RadioManagerDatabaseError)
			.addError(RadioErrors.RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.patch("updateBlock")`/radios/${RadioIdParam}/schedule/blocks/${BlockIdParam}`
			.setPayload(UpdateScheduleBlock)
			.addSuccess(ScheduleBlock)
			.addError(ScheduleBlockConflictError)
			.addError(ScheduleBlockNotFoundError)
			.addError(ScheduleBlockRepositoryError)
			.addError(RadioErrors.RadioManagerDatabaseError)
			.addError(RadioErrors.RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.del("deleteBlock")`/radios/${RadioIdParam}/schedule/blocks/${BlockIdParam}`
			.addSuccess(Schema.Void)
			.addError(ScheduleBlockRepositoryError)
			.addError(RadioErrors.RadioManagerDatabaseError)
			.addError(RadioErrors.RadioNotFound)
			.middleware(Authorization),
	)
	.add(
		HttpApiEndpoint.post("validateBlock")`/radios/${RadioIdParam}/schedule/blocks/validate`
			.setPayload(
				Schema.Struct({
					candidate: CreateScheduleBlock,
					range: ScheduleVisibleRange,
					excludeBlockId: Schema.optional(Schema.String),
				}),
			)
			.addSuccess(ValidateScheduleBlockResponse)
			.addError(ScheduleBlockConflictError)
			.addError(ScheduleBlockRepositoryError)
			.addError(RadioErrors.RadioManagerDatabaseError)
			.addError(RadioErrors.RadioNotFound)
			.middleware(Authorization),
	)

type Segment = {
	readonly weekday: Weekday
	readonly startMinuteOfDay: MinuteOfDay
	readonly endMinuteOfDay: MinuteOfDay
}

const toMinuteOfDay = (date: DateTime.Zoned) => {
	const parts = DateTime.toParts(date)
	return parts.hours * 60 + parts.minutes
}

const dayAfter = (weekday: Weekday): Weekday => (weekday === 7 ? 1 : weekday + 1) as Weekday

const rangesOverlap = (
	left: { readonly startMinuteOfDay: number; readonly endMinuteOfDay: number },
	right: { readonly startMinuteOfDay: number; readonly endMinuteOfDay: number },
) => left.startMinuteOfDay < right.endMinuteOfDay && right.startMinuteOfDay < left.endMinuteOfDay

const toWeeklySegments = (
	block: Pick<ScheduleWeeklyBlock, "weekday" | "startMinuteOfDay" | "endMinuteOfDay">,
): ReadonlyArray<Segment> =>
	block.endMinuteOfDay > block.startMinuteOfDay
		? [block]
		: [
				{
					weekday: block.weekday,
					startMinuteOfDay: block.startMinuteOfDay,
					endMinuteOfDay: 24 * 60,
				},
				{
					weekday: dayAfter(block.weekday),
					startMinuteOfDay: 0,
					endMinuteOfDay: block.endMinuteOfDay,
				},
			]

const zonedMidnightAfter = (date: DateTime.Zoned, timezone: string) => {
	const parts = DateTime.toParts(date)
	return DateTime.unsafeMakeZoned(
		{
			year: parts.year,
			month: parts.month,
			day: parts.day + 1,
			hours: 0,
			minutes: 0,
			seconds: 0,
			millis: 0,
		},
		{ timeZone: timezone, adjustForTimeZone: true, disambiguation: "compatible" },
	)
}

const toOneOffSegments = (
	block: Pick<ScheduleOneOffBlock, "startsAt" | "endsAt">,
	timezone: string,
) => {
	const segments: Array<
		Segment & { readonly startsAt: DateTime.Utc; readonly endsAt: DateTime.Utc }
	> = []
	let cursor = DateTime.setZone(block.startsAt, DateTime.zoneUnsafeMakeNamed(timezone))
	const end = DateTime.setZone(block.endsAt, DateTime.zoneUnsafeMakeNamed(timezone))

	while (DateTime.lessThan(cursor, end)) {
		const segmentEnd = DateTime.min(end, zonedMidnightAfter(cursor, timezone))
		const endMinuteOfDay =
			DateTime.toEpochMillis(segmentEnd) ===
			DateTime.toEpochMillis(zonedMidnightAfter(cursor, timezone))
				? 24 * 60
				: toMinuteOfDay(segmentEnd)
		segments.push({
			weekday: DateTime.toParts(cursor).weekDay as Weekday,
			startMinuteOfDay: toMinuteOfDay(cursor) as MinuteOfDay,
			endMinuteOfDay: endMinuteOfDay as MinuteOfDay,
			startsAt: DateTime.toUtc(cursor),
			endsAt: DateTime.toUtc(segmentEnd),
		})
		cursor = segmentEnd
	}

	return segments
}

const segmentOverlap = (left: Segment, right: Segment) =>
	left.weekday === right.weekday && rangesOverlap(left, right)

const buildHints = (left: Segment, right: Segment): ReadonlyArray<CollisionHint> => [
	{
		direction: "backward",
		anchorMinuteOfDay: left.startMinuteOfDay,
		targetMinuteOfDay: right.startMinuteOfDay,
	},
	{
		direction: "forward",
		anchorMinuteOfDay: left.endMinuteOfDay,
		targetMinuteOfDay: right.endMinuteOfDay,
	},
]

const blockIdOf = (block: ScheduleBlock) => block.id as string
const isWeeklyBlock = (
	block: ScheduleBlock,
): block is Extract<ScheduleBlock, { readonly blockKind: "weekly" }> => block.blockKind === "weekly"
const isOneOffBlock = (
	block: ScheduleBlock,
): block is Extract<ScheduleBlock, { readonly blockKind: "one-off" }> =>
	block.blockKind === "one-off"

const conflictFromSegments = (
	candidate: ScheduleBlock,
	existing: ScheduleBlock,
	conflictKind: ConflictKind,
	segments: ReadonlyArray<{ readonly candidate: Segment; readonly existing: Segment }>,
	overlapRange: ScheduleOverlapRange | null,
): ScheduleBlockConflict => ({
	candidateBlockId: blockIdOf(candidate),
	existingBlockId: blockIdOf(existing),
	conflictKind,
	overlapRange,
	segments: segments.map(({ candidate, existing }) => ({
		weekday: candidate.weekday,
		startMinuteOfDay: Math.max(
			candidate.startMinuteOfDay,
			existing.startMinuteOfDay,
		) as MinuteOfDay,
		endMinuteOfDay: Math.min(candidate.endMinuteOfDay, existing.endMinuteOfDay) as MinuteOfDay,
	})),
	hints: segments.flatMap(({ candidate, existing }) => buildHints(candidate, existing)),
})

export const normalizeScheduleBlock = <T extends CreateScheduleBlock | ScheduleBlock>(
	block: T,
): T => block

export const projectWeeklyBlockOccurrences = (
	block: ScheduleWeeklyBlock,
	range: ScheduleVisibleRange,
	timezone: string,
): ReadonlyArray<WeeklyOccurrence> => {
	const zone = DateTime.zoneUnsafeMakeNamed(timezone)
	const startZoned = DateTime.setZone(range.rangeStart, zone)
	const endZoned = DateTime.setZone(range.rangeEnd, zone)
	const days =
		Math.ceil(
			Math.max(0, DateTime.toEpochMillis(endZoned) - DateTime.toEpochMillis(startZoned)) /
				(24 * 60 * 60 * 1000),
		) + 1
	const occurrences: WeeklyOccurrence[] = []

	for (let offset = 0; offset < days; offset++) {
		const reference = DateTime.add(startZoned, { days: offset })
		const parts = DateTime.toParts(reference)
		if (parts.weekDay !== block.weekday) continue
		const startHours = Math.floor(block.startMinuteOfDay / 60)
		const startMinutes = block.startMinuteOfDay % 60
		const start = DateTime.unsafeMakeZoned(
			{
				year: parts.year,
				month: parts.month,
				day: parts.day,
				hours: startHours,
				minutes: startMinutes,
				seconds: 0,
				millis: 0,
			},
			{ timeZone: timezone, adjustForTimeZone: true, disambiguation: "compatible" },
		)
		const end =
			block.endMinuteOfDay > block.startMinuteOfDay
				? DateTime.unsafeMakeZoned(
						{
							year: parts.year,
							month: parts.month,
							day: parts.day,
							hours: Math.floor(block.endMinuteOfDay / 60),
							minutes: block.endMinuteOfDay % 60,
							seconds: 0,
							millis: 0,
						},
						{ timeZone: timezone, adjustForTimeZone: true, disambiguation: "compatible" },
					)
				: DateTime.add(
						DateTime.unsafeMakeZoned(
							{
								year: parts.year,
								month: parts.month,
								day: parts.day,
								hours: Math.floor(block.endMinuteOfDay / 60),
								minutes: block.endMinuteOfDay % 60,
								seconds: 0,
								millis: 0,
							},
							{ timeZone: timezone, adjustForTimeZone: true, disambiguation: "compatible" },
						),
						{ days: 1 },
					)
		const startsAt = DateTime.toUtc(start)
		const endsAt = DateTime.toUtc(end)
		if (
			DateTime.lessThan(startsAt, range.rangeEnd) &&
			DateTime.lessThan(range.rangeStart, endsAt)
		) {
			occurrences.push({
				blockId: block.id,
				weekday: block.weekday,
				startMinuteOfDay: block.startMinuteOfDay,
				endMinuteOfDay: block.endMinuteOfDay,
				startsAt,
				endsAt,
			})
		}
	}

	return occurrences.sort(
		(a, b) => DateTime.toEpochMillis(a.startsAt) - DateTime.toEpochMillis(b.startsAt),
	)
}

export const projectWeeklyBlocksOccurrences = (
	blocks: ReadonlyArray<ScheduleWeeklyBlock>,
	range: ScheduleVisibleRange,
	timezone: string,
) => blocks.flatMap((block) => projectWeeklyBlockOccurrences(block, range, timezone))

export const findBlockConflicts = (
	existingBlocks: ReadonlyArray<ScheduleBlock>,
	candidateBlock: ScheduleBlock,
	timezone: string,
	options?: { readonly excludeBlockId?: string | null },
): ReadonlyArray<ScheduleBlockConflict> =>
	existingBlocks.flatMap((existing) => {
		if (options?.excludeBlockId != null && blockIdOf(existing) === options.excludeBlockId) return []
		if (blockIdOf(existing) === blockIdOf(candidateBlock)) return []

		if (candidateBlock.blockKind === "one-off" && existing.blockKind === "one-off") {
			if (
				DateTime.lessThan(candidateBlock.startsAt, existing.endsAt) &&
				DateTime.lessThan(existing.startsAt, candidateBlock.endsAt)
			) {
				return [
					conflictFromSegments(candidateBlock, existing, "one-off-one-off", [], {
						startsAt: DateTime.max(candidateBlock.startsAt, existing.startsAt),
						endsAt: DateTime.min(candidateBlock.endsAt, existing.endsAt),
					}),
				]
			}
			return []
		}

		if (candidateBlock.blockKind === "weekly" && existing.blockKind === "weekly") {
			const candidateSegments = toWeeklySegments(candidateBlock)
			const existingSegments = toWeeklySegments(existing)
			const overlaps = candidateSegments.flatMap((candidateSegment) =>
				existingSegments
					.filter((existingSegment) => segmentOverlap(candidateSegment, existingSegment))
					.map((existingSegment) => ({ candidate: candidateSegment, existing: existingSegment })),
			)
			return overlaps.length === 0
				? []
				: [conflictFromSegments(candidateBlock, existing, "weekly-weekly", overlaps, null)]
		}

		const weekly = isWeeklyBlock(candidateBlock)
			? candidateBlock
			: isWeeklyBlock(existing)
				? existing
				: null
		const oneOff = isOneOffBlock(candidateBlock)
			? candidateBlock
			: isOneOffBlock(existing)
				? existing
				: null
		if (weekly == null || oneOff == null) {
			return []
		}
		const weeklySegments = toWeeklySegments(weekly)
		const oneOffSegments = toOneOffSegments(oneOff, timezone)
		const overlaps = weeklySegments.flatMap((weeklySegment) =>
			oneOffSegments
				.filter((oneOffSegment) => segmentOverlap(weeklySegment, oneOffSegment))
				.map((oneOffSegment) => ({
					candidate: candidateBlock.blockKind === "weekly" ? weeklySegment : oneOffSegment,
					existing: candidateBlock.blockKind === "weekly" ? oneOffSegment : weeklySegment,
				})),
		)
		return overlaps.length === 0
			? []
			: [
					conflictFromSegments(
						candidateBlock,
						existing,
						"weekly-one-off",
						overlaps,
						isOneOffBlock(candidateBlock)
							? {
									startsAt: candidateBlock.startsAt,
									endsAt: candidateBlock.endsAt,
								}
							: {
									startsAt: oneOff.startsAt,
									endsAt: oneOff.endsAt,
								},
					),
				]
	})

export const findScheduleConflicts = (
	blocks: ReadonlyArray<ScheduleBlock>,
	timezone: string,
): ReadonlyArray<ScheduleBlockConflict> =>
	blocks.flatMap((block, index) => findBlockConflicts(blocks.slice(index + 1), block, timezone))

export const resolveCollisionHints = (conflicts: ReadonlyArray<ScheduleBlockConflict>) =>
	pipe(
		conflicts.flatMap((conflict) => conflict.hints),
		Arr.sort(
			Order.mapInput(Order.number, (hint: CollisionHint) =>
				hint.direction === "backward" ? hint.targetMinuteOfDay * -1 : hint.targetMinuteOfDay,
			),
		),
	)
