import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"

import { Id, Radio, Schedule } from "@radiant/client/lib"

import { RadioRepository } from "../RadioManager"
import { ScheduleBlockRepository } from "./ScheduleBlockRepository"

export type ScheduleBlockServiceShape = {
	readonly listAllBlocks: (radioId: Schedule.ScheduleWeeklyBlock["radioId"]) => Effect.Effect<
		{
			readonly weekly: ReadonlyArray<Schedule.ScheduleWeeklyBlock>
			readonly oneOff: ReadonlyArray<Schedule.ScheduleOneOffBlock>
		},
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
	>
	readonly listBlocks: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		query: Schedule.ScheduleBlocksQuery,
	) => Effect.Effect<
		Schedule.ScheduleBlocksResponse,
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
	>
	readonly createBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		draft: Schedule.CreateScheduleBlock,
	) => Effect.Effect<
		Schedule.ScheduleBlock,
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
		| Schedule.ScheduleBlockConflictError
	>
	readonly updateBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		blockId: string,
		patch: Schedule.UpdateScheduleBlock,
	) => Effect.Effect<
		Schedule.ScheduleBlock,
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
		| Schedule.ScheduleBlockConflictError
		| Schedule.ScheduleBlockNotFoundError
	>
	readonly deleteBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		blockId: string,
	) => Effect.Effect<
		void,
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
	>
	readonly validateCandidate: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		candidate: Schedule.CreateScheduleBlock | Schedule.ScheduleBlock,
		context?: {
			readonly excludeBlockId?: string
			readonly range?: Schedule.ScheduleVisibleRange
		},
	) => Effect.Effect<
		Schedule.ValidateScheduleBlockResponse,
		| Radio.Errors.RadioManagerDatabaseError
		| Radio.Errors.RadioNotFound
		| Schedule.ScheduleBlockRepositoryError
	>
}

export class ScheduleBlockService extends Context.Tag("ScheduleBlockService")<
	ScheduleBlockService,
	ScheduleBlockServiceShape
>() {}

const toBlockArray = (blocks: {
	readonly weekly: ReadonlyArray<Schedule.ScheduleWeeklyBlock>
	readonly oneOff: ReadonlyArray<Schedule.ScheduleOneOffBlock>
}): ReadonlyArray<Schedule.ScheduleBlock> => [
	...blocks.weekly.map((block) => ({ ...block, blockKind: "weekly" as const })),
	...blocks.oneOff.map((block) => ({ ...block, blockKind: "one-off" as const })),
]

const normalizeUpdate = (
	current: Schedule.ScheduleBlock,
	patch: Schedule.UpdateScheduleBlock,
): Schedule.ScheduleBlock => {
	if (current.blockKind === "weekly" && patch.blockKind === "weekly") {
		return { ...current, ...patch, target: patch.target ?? current.target }
	}
	if (current.blockKind === "one-off" && patch.blockKind === "one-off") {
		return { ...current, ...patch, target: patch.target ?? current.target }
	}
	return current
}

const toOneOffCursor = (cursor: string | undefined): Schedule.ScheduleOneOffBlockId | undefined => {
	if (cursor == null) {
		return undefined
	}
	const decoded = Schema.decodeUnknownOption(Schedule.ScheduleOneOffBlockId)(cursor)
	return Option.isSome(decoded) ? decoded.value : undefined
}

export const ScheduleBlockServiceLive = Layer.effect(
	ScheduleBlockService,
	Effect.gen(function* () {
		const repository = yield* ScheduleBlockRepository
		const radioRepository = yield* RadioRepository

		const validateCandidate: ScheduleBlockServiceShape["validateCandidate"] = (
			radioId,
			candidate,
			context,
		) =>
			Effect.gen(function* () {
				const radio = yield* radioRepository.getRadioInfo(radioId)
				const blocks = yield* repository.listAllBlocks(radioId)
				const normalizedCandidate: Schedule.ScheduleBlock =
					"id" in candidate
						? candidate
						: candidate.blockKind === "weekly"
							? {
									...candidate,
									id: Id.random(Schedule.scheduleWeeklyBlockIdPrefix),
									radioId,
									createdAt: DateTime.unsafeNow(),
									updatedAt: DateTime.unsafeNow(),
								}
							: {
									...candidate,
									id: Id.random(Schedule.scheduleOneOffBlockIdPrefix),
									radioId,
									createdAt: DateTime.unsafeNow(),
									updatedAt: DateTime.unsafeNow(),
								}
				const conflicts = Schedule.findBlockConflicts(
					toBlockArray(blocks),
					normalizedCandidate,
					radio.timezone,
					{
						excludeBlockId: context?.excludeBlockId ?? null,
					},
				)
				return {
					ok: conflicts.length === 0,
					conflicts,
					weeklyOccurrences:
						context?.range == null
							? []
							: Schedule.projectWeeklyBlocksOccurrences(
									blocks.weekly,
									context.range,
									radio.timezone,
								),
				}
			})

		const listAllBlocks: ScheduleBlockServiceShape["listAllBlocks"] = (radioId) =>
			Effect.gen(function* () {
				yield* radioRepository.getRadioInfo(radioId)
				return yield* repository.listAllBlocks(radioId)
			})

		const listBlocks: ScheduleBlockServiceShape["listBlocks"] = (radioId, query) =>
			Effect.gen(function* () {
				const radio = yield* radioRepository.getRadioInfo(radioId)
				const weekly = yield* repository.listWeeklyBlocks(radioId)
				const allOneOff = yield* repository.listOneOffBlocks({
					radioId,
					cursor: toOneOffCursor(query.oneOffCursor),
					limit: (query.oneOffLimit ?? 50) + 1,
				})
				const visible = allOneOff.filter(
					(block) =>
						DateTime.lessThan(block.startsAt, query.rangeEnd) &&
						DateTime.lessThan(query.rangeStart, block.endsAt),
				)
				const pageSize = query.oneOffLimit ?? 50
				const items = visible.slice(0, pageSize)
				const nextRow = allOneOff[pageSize]
				return {
					weekly: {
						rules: weekly,
						occurrences: Schedule.projectWeeklyBlocksOccurrences(weekly, query, radio.timezone),
					},
					oneOff: {
						items,
						pageInfo: {
							cursor: nextRow?.id ?? null,
							hasMore: nextRow != null,
						},
					},
				}
			})

		const createBlock: ScheduleBlockServiceShape["createBlock"] = (radioId, draft) =>
			Effect.gen(function* () {
				const validation = yield* validateCandidate(radioId, draft)
				if (!validation.ok) {
					return yield* Effect.fail(
						new Schedule.ScheduleBlockConflictError({ radioId, conflicts: validation.conflicts }),
					)
				}
				return yield* repository.insertBlock(radioId, draft)
			})

		const updateBlock: ScheduleBlockServiceShape["updateBlock"] = (radioId, blockId, patch) =>
			Effect.gen(function* () {
				const current = yield* repository.getBlock(radioId, blockId)
				if (current == null) {
					return yield* Effect.fail(new Schedule.ScheduleBlockNotFoundError({ blockId }))
				}
				const next = normalizeUpdate(current, patch)
				const validation = yield* validateCandidate(radioId, next, { excludeBlockId: blockId })
				if (!validation.ok) {
					return yield* Effect.fail(
						new Schedule.ScheduleBlockConflictError({ radioId, conflicts: validation.conflicts }),
					)
				}
				return yield* repository.updateBlock(radioId, next)
			})

		const deleteBlock: ScheduleBlockServiceShape["deleteBlock"] = (radioId, blockId) =>
			repository.deleteBlock(radioId, blockId)

		return {
			listAllBlocks,
			listBlocks,
			createBlock,
			updateBlock,
			deleteBlock,
			validateCandidate,
		}
	}),
)
