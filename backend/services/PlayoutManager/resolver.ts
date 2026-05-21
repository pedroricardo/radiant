import { AudioSource } from "@radiant/backend/lib"
import { MediaLibrary, MediaNode, Playout, Schedule, type Radio } from "@radiant/client"
import type { ScheduleOneOffBlock, ScheduleWeeklyBlock } from "@radiant/client/lib/Playout"
import {
	Array as Arr,
	Data,
	DateTime,
	Duration,
	Effect,
	Match,
	Option,
	Order,
	Stream,
	pipe,
} from "effect"
import assert from "node:assert/strict"

import { AudioMultiplexer } from "../AudioMultiplexer"
import { MediaLibraryService } from "../MediaLibraryService"
import * as RadioManager from "../RadioManager"
import { ScheduleBlockService as ScheduleBlockServiceTag } from "../ScheduleBlockService"
import * as StorageService from "../StorageService"
import * as PlayoutState from "./PlayoutState"

type ScheduleBlock = Data.TaggedEnum<{
	OneOff: Playout.ScheduleOneOffBlock
	Weekly: Playout.ScheduleWeeklyBlock
}>

const ScheduleBlock = Data.taggedEnum<ScheduleBlock>()

type ResolvedMediaNode = Pick<MediaNode.MediaNode, "id" | "storageKey" | "durationMs">

type BlockOccurrence = {
	readonly block: ScheduleBlock
	readonly startsAt: DateTime.Utc
	readonly endsAt: DateTime.Utc
}

const dateTimeOrder = Order.mapInput(Order.number, DateTime.toEpochMillis)
const blockOccurrenceOrder = Order.mapInput(
	dateTimeOrder,
	(occurrence: BlockOccurrence) => occurrence.startsAt,
)
const nextPlanOrder = Order.mapInput(
	dateTimeOrder,
	(nextPlan: PlayoutState.NextPlan) => nextPlan.at,
)

export class FetchBlocksError extends Data.TaggedError("FetchBlocksError")<{
	message: string
	cause:
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
	radioId: Radio.RadioId
}> {}

export class FetchMediaNodeError extends Data.TaggedError("FetchMediaNodeError")<{
	message: string
	cause: MediaLibrary.MediaLibraryServiceError | MediaLibrary.MediaLibraryNodeNotFoundError
	radioId: Radio.RadioId
	mediaNodeId: MediaNode.MediaNodeId
}> {}

const resolveMediaNode = Effect.fn("PlayoutResolver.resolveMediaNode")(function* (
	radioId: Radio.RadioId,
	mediaNodeId: MediaNode.MediaNodeId,
) {
	const mediaLibrary = yield* MediaLibraryService
	const mediaNode = yield* mediaLibrary.getNode({ radioId, nodeId: mediaNodeId }).pipe(
		Effect.mapError(
			(cause) =>
				new FetchMediaNodeError({
					cause,
					message: `failed to fetch media node ${mediaNodeId} for radio ${radioId}`,
					radioId,
					mediaNodeId,
				}),
		),
	)
	return {
		id: mediaNode.id,
		storageKey: mediaNode.storageKey,
		durationMs: mediaNode.durationMs,
	} satisfies ResolvedMediaNode
})

const buildWeeklyOccurrence = (
	block: ScheduleWeeklyBlock,
	timezone: string,
	nowUtc: DateTime.Utc,
): {
	readonly current: Option.Option<BlockOccurrence>
	readonly next: BlockOccurrence
} => {
	const nowZoned = DateTime.setZone(nowUtc, DateTime.zoneUnsafeMakeNamed(timezone))
	const nowParts = DateTime.toParts(nowZoned)
	const currentWeekday = nowParts.weekDay
	const startHours = Math.floor(block.startMinuteOfDay / 60)
	const startMinutes = block.startMinuteOfDay % 60
	const endHours = Math.floor(block.endMinuteOfDay / 60)
	const endMinutes = block.endMinuteOfDay % 60

	const makeOccurrence = (dayOffset: number): BlockOccurrence => {
		const reference = DateTime.add(nowUtc, { days: dayOffset })
		const referenceZoned = DateTime.setZone(reference, DateTime.zoneUnsafeMakeNamed(timezone))
		const referenceParts = DateTime.toParts(referenceZoned)
		return {
			block: ScheduleBlock.Weekly(block),
			startsAt: DateTime.toUtc(
				DateTime.unsafeMakeZoned(
					{
						year: referenceParts.year,
						month: referenceParts.month,
						day: referenceParts.day,
						hours: startHours,
						minutes: startMinutes,
						seconds: 0,
					},
					{
						timeZone: timezone,
						adjustForTimeZone: true,
						disambiguation: "compatible",
					},
				),
			),
			endsAt: DateTime.toUtc(
				DateTime.unsafeMakeZoned(
					{
						year: referenceParts.year,
						month: referenceParts.month,
						day: referenceParts.day,
						hours: endHours,
						minutes: endMinutes,
						seconds: 0,
					},
					{
						timeZone: timezone,
						adjustForTimeZone: true,
						disambiguation: "compatible",
					},
				),
			),
		}
	}

	let current = Option.none<BlockOccurrence>()
	if (currentWeekday === block.weekday) {
		const today = makeOccurrence(0)
		if (
			DateTime.greaterThanOrEqualTo(nowUtc, today.startsAt) &&
			DateTime.lessThan(nowUtc, today.endsAt)
		) {
			current = Option.some(today)
		}
	}

	let daysUntilNext = (block.weekday - currentWeekday + 7) % 7
	if (daysUntilNext === 0 && Option.isSome(current)) {
		daysUntilNext = 7
	}
	const tentativeNext = makeOccurrence(daysUntilNext)
	const next =
		daysUntilNext === 0 && DateTime.greaterThanOrEqualTo(nowUtc, tentativeNext.startsAt)
			? makeOccurrence(7)
			: tentativeNext

	return { current, next }
}

const resolveOneOffOccurrence = (
	block: ScheduleOneOffBlock,
	nowUtc: DateTime.Utc,
): {
	readonly current: Option.Option<BlockOccurrence>
	readonly next: Option.Option<BlockOccurrence>
} => ({
	current:
		DateTime.lessThan(block.startsAt, block.endsAt) &&
		DateTime.greaterThanOrEqualTo(nowUtc, block.startsAt) &&
		DateTime.lessThan(nowUtc, block.endsAt)
			? Option.some({
					block: ScheduleBlock.OneOff(block),
					startsAt: block.startsAt,
					endsAt: block.endsAt,
				})
			: Option.none(),
	next: DateTime.lessThan(block.startsAt, block.endsAt)
		? Option.some({
				block: ScheduleBlock.OneOff(block),
				startsAt: block.startsAt,
				endsAt: block.endsAt,
			})
		: Option.none(),
})

const resolveCurrentPlanFromOccurrence = Effect.fn(
	"PlayoutResolver.resolveCurrentPlanFromOccurrence",
)(function* (occurrence: BlockOccurrence, radioId: Radio.RadioId, nowUtc: DateTime.Utc) {
	const block = ScheduleBlock.$match({
		OneOff: (oneOff) => ({ blockKind: "one-off" as const, block: oneOff }),
		Weekly: (weekly) => ({ blockKind: "weekly" as const, block: weekly }),
	})(occurrence.block)
	if (block.block.target.targetType !== "audio_file" || block.block.target.mediaNodeId == null) {
		return Option.none<PlayoutState.CurrentPlan>()
	}
	const mediaNode = yield* resolveMediaNode(radioId, block.block.target.mediaNodeId)
	assert.notEqual(mediaNode.durationMs, null)
	assert.notEqual(mediaNode.storageKey, null)
	const actualEndsAt = DateTime.min(
		occurrence.endsAt,
		DateTime.addDuration(occurrence.startsAt, mediaNode.durationMs!),
	)
	if (
		DateTime.lessThan(nowUtc, occurrence.startsAt) ||
		DateTime.greaterThanOrEqualTo(nowUtc, actualEndsAt)
	) {
		return Option.none<PlayoutState.AudioFilePlan>()
	}
	return Option.some(
		PlayoutState.CurrentPlan.AudioFile({
			blockId: block.block.id,
			blockKind: block.blockKind,
			mediaNodeId: mediaNode.id,
			storageKey: mediaNode.storageKey!,
			playbackPosition: DateTime.distanceDuration(occurrence.startsAt, nowUtc),
			startsAt: occurrence.startsAt,
			endsAt: actualEndsAt,
		}),
	)
})

const resolveFuturePlanFromOccurrence = Effect.fn(
	"PlayoutResolver.resolveFuturePlanFromOccurrence",
)(function* (occurrence: BlockOccurrence, radioId: Radio.RadioId) {
	const block = ScheduleBlock.$match({
		OneOff: (oneOff) => ({ blockKind: "one-off" as const, block: oneOff }),
		Weekly: (weekly) => ({ blockKind: "weekly" as const, block: weekly }),
	})(occurrence.block)
	if (block.block.target.targetType !== "audio_file" || block.block.target.mediaNodeId == null) {
		return PlayoutState.CurrentPlan.Silence()
	}
	const mediaNode = yield* resolveMediaNode(radioId, block.block.target.mediaNodeId)
	assert.notEqual(mediaNode.durationMs, null)
	assert.notEqual(mediaNode.storageKey, null)
	return PlayoutState.CurrentPlan.AudioFile({
		blockId: block.block.id,
		blockKind: block.blockKind,
		mediaNodeId: mediaNode.id,
		storageKey: mediaNode.storageKey!,
		playbackPosition: Duration.zero,
		startsAt: occurrence.startsAt,
		endsAt: DateTime.min(
			occurrence.endsAt,
			DateTime.addDuration(occurrence.startsAt, mediaNode.durationMs!),
		),
	})
})

export const fetchBlocks = Effect.fn("PlayoutResolver.fetchBlocks")(function* (
	radioId: Radio.RadioId,
) {
	const scheduleBlocks = yield* ScheduleBlockServiceTag
	const { oneOff, weekly } = yield* scheduleBlocks.listAllBlocks(radioId).pipe(
		Effect.mapError(
			(cause) =>
				new FetchBlocksError({
					message: "failed to fetch schedule blocks for playout resolution",
					cause,
					radioId,
				}),
		),
	)

	return [
		...oneOff.map(ScheduleBlock.OneOff),
		...weekly.map(ScheduleBlock.Weekly),
	] satisfies ReadonlyArray<ScheduleBlock>
})

const sortOccurrences = (occurrences: ReadonlyArray<BlockOccurrence>) =>
	Arr.sort(blockOccurrenceOrder)(occurrences)

export const resolveTimelineSnapshot = Effect.fn("PlayoutResolver.resolveTimelineSnapshot")(
	function* (radioId: Radio.RadioId) {
		const radioRepo = yield* RadioManager.RadioRepository
		const radio = yield* radioRepo.getRadioInfo(radioId)
		const blocks = yield* fetchBlocks(radioId)
		const nowUtc = yield* DateTime.now

		const currentCandidates: BlockOccurrence[] = []
		const futureCandidates: BlockOccurrence[] = []

		for (const block of blocks) {
			yield* ScheduleBlock.$match({
				OneOff: (oneOff) =>
					Effect.sync(() => {
						const occurrence = resolveOneOffOccurrence(oneOff, nowUtc)
						if (Option.isSome(occurrence.current)) {
							currentCandidates.push(occurrence.current.value)
						}
						if (
							Option.isSome(occurrence.next) &&
							DateTime.greaterThan(occurrence.next.value.startsAt, nowUtc)
						) {
							futureCandidates.push(occurrence.next.value)
						}
					}),
				Weekly: (weekly) =>
					Effect.sync(() => {
						const occurrence = buildWeeklyOccurrence(weekly, radio.timezone, nowUtc)
						if (Option.isSome(occurrence.current)) {
							currentCandidates.push(occurrence.current.value)
						}
						if (DateTime.greaterThan(occurrence.next.startsAt, nowUtc)) {
							futureCandidates.push(occurrence.next)
						}
					}),
			})(block)
		}

		const sortedCurrentCandidates = sortOccurrences(currentCandidates)
		const currentOccurrence = Arr.last(sortedCurrentCandidates)

		const currentPlanOption = Option.isSome(currentOccurrence)
			? yield* resolveCurrentPlanFromOccurrence(currentOccurrence.value, radioId, nowUtc)
			: Option.none<PlayoutState.CurrentPlan>()

		const current = Option.getOrElse(currentPlanOption, () => PlayoutState.CurrentPlan.Silence())

		const nextBoundaryCandidates: Array<PlayoutState.NextPlan> = []

		if (current._tag !== "Silence" && DateTime.greaterThan(current.endsAt, nowUtc)) {
			nextBoundaryCandidates.push({
				at: current.endsAt,
				plan: PlayoutState.CurrentPlan.Silence(),
			})
		}

		for (const occurrence of sortOccurrences(futureCandidates)) {
			const plan = yield* resolveFuturePlanFromOccurrence(occurrence, radioId)
			nextBoundaryCandidates.push({
				at: occurrence.startsAt,
				plan,
			})
		}

		const nextOption = Arr.head(Arr.sort(nextPlanOrder)(nextBoundaryCandidates))

		yield* Effect.logDebug("playout.resolver.snapshot").pipe(
			Effect.annotateLogs({
				radioId,
				current: current._tag,
				currentBlockId:
					current._tag === "AudioFile" || current._tag === "Playlist" ? current.blockId : null,
				nextAt: pipe(
					nextOption,
					Option.map((next) => DateTime.toEpochMillis(next.at)),
					Option.getOrNull,
				),
				nextPlan: pipe(
					nextOption,
					Option.map((next) => next.plan._tag),
					Option.getOrNull,
				),
				nextBlockId: pipe(
					nextOption,
					Option.filterMap((next) =>
						next.plan._tag !== "AudioFile" && next.plan._tag !== "Playlist"
							? Option.none()
							: Option.some(next.plan.blockId),
					),
					Option.getOrNull,
				),
				futureCandidateCount: futureCandidates.length,
				currentCandidateCount: currentCandidates.length,
			}),
		)

		return {
			current,
			next: nextOption,
		} satisfies PlayoutState.TimelineSnapshot
	},
)

export const applyCurrentPlanToMultiplexer = Effect.fn(
	"PlayoutResolver.applyCurrentPlanToMultiplexer",
)(function* (
	radioId: Radio.RadioId,
	multiplexer: typeof AudioMultiplexer.Service,
	plan: PlayoutState.CurrentPlan,
) {
	const storage = yield* StorageService.StorageService
	yield* Match.value(plan).pipe(
		Match.tagsExhaustive({
			Silence: () => multiplexer.setCluster([]),
			AudioFile: (audioPlan) =>
				AudioSource.fromStorageObject(audioPlan.storageKey, {
					seek: audioPlan.playbackPosition,
				}).pipe(
					Effect.provideService(StorageService.StorageService, storage),
					Effect.map(AudioSource.mapStream(Stream.timeout("3 seconds"))),
					Effect.flatMap((source) =>
						multiplexer.setCluster([
							{
								id: audioPlan.mediaNodeId,
								volume: 1,
								source,
							},
						]),
					),
				),
			Playlist: () => Effect.die("playlist playout is not implemented yet"),
		}),
	)
})
