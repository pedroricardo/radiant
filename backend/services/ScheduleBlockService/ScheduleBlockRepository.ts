import { and, eq, gt } from "drizzle-orm"
import { Cause, Context, Effect, Layer, ParseResult, Schema } from "effect"

import { Id, MediaNode, Playlist, Radio, Schedule } from "@radiant/client/lib"

import { Drizzle } from "../Drizzle"
import { scheduleOneOffBlocks } from "../Drizzle/schema/scheduleOneOffBlocks"
import { scheduleWeeklyBlocks } from "../Drizzle/schema/scheduleWeeklyBlocks"

type WeeklyRow = typeof scheduleWeeklyBlocks.$inferSelect
type OneOffRow = typeof scheduleOneOffBlocks.$inferSelect

export type ListOneOffBlocksArgs = {
	readonly radioId: Schedule.ScheduleWeeklyBlock["radioId"]
	readonly cursor?: Schedule.ScheduleOneOffBlockId
	readonly limit: number
}

export type ScheduleBlockRepositoryShape = {
	readonly listWeeklyBlocks: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
	) => Effect.Effect<
		ReadonlyArray<Schedule.ScheduleWeeklyBlock>,
		Schedule.ScheduleBlockRepositoryError
	>
	readonly listOneOffBlocks: (
		args: ListOneOffBlocksArgs,
	) => Effect.Effect<
		ReadonlyArray<Schedule.ScheduleOneOffBlock>,
		Schedule.ScheduleBlockRepositoryError
	>
	readonly listAllBlocks: (radioId: Schedule.ScheduleWeeklyBlock["radioId"]) => Effect.Effect<
		{
			readonly weekly: ReadonlyArray<Schedule.ScheduleWeeklyBlock>
			readonly oneOff: ReadonlyArray<Schedule.ScheduleOneOffBlock>
		},
		Schedule.ScheduleBlockRepositoryError
	>
	readonly getBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		blockId: string,
	) => Effect.Effect<Schedule.ScheduleBlock | null, Schedule.ScheduleBlockRepositoryError>
	readonly insertBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		block: Schedule.CreateScheduleBlock,
	) => Effect.Effect<Schedule.ScheduleBlock, Schedule.ScheduleBlockRepositoryError>
	readonly updateBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		block: Schedule.ScheduleBlock,
	) => Effect.Effect<Schedule.ScheduleBlock, Schedule.ScheduleBlockRepositoryError>
	readonly deleteBlock: (
		radioId: Schedule.ScheduleWeeklyBlock["radioId"],
		blockId: string,
	) => Effect.Effect<void, Schedule.ScheduleBlockRepositoryError>
}

export class ScheduleBlockRepository extends Context.Tag("ScheduleBlockRepository")<
	ScheduleBlockRepository,
	ScheduleBlockRepositoryShape
>() {}

const PersistedWeeklyPlaylistRow = Schema.Struct({
	id: Schedule.ScheduleWeeklyBlockId,
	radioId: Radio.RadioId,
	weekday: Schedule.Weekday,
	startMinuteOfDay: Schedule.MinuteOfDay,
	endMinuteOfDay: Schedule.MinuteOfDay,
	targetType: Schema.Literal("playlist"),
	playlistId: Playlist.PlaylistId,
	mediaNodeId: Schema.Null,
	playlistFillMode: Schedule.PlaylistFillMode,
	playbackMode: Schedule.BlockPlaybackMode,
	modeAfterPlayback: Schedule.ModeAfterPlayback,
	createdAt: Schema.String,
	updatedAt: Schema.String,
})

const PersistedWeeklyAudioFileRow = Schema.Struct({
	id: Schedule.ScheduleWeeklyBlockId,
	radioId: Radio.RadioId,
	weekday: Schedule.Weekday,
	startMinuteOfDay: Schedule.MinuteOfDay,
	endMinuteOfDay: Schedule.MinuteOfDay,
	targetType: Schema.Literal("audio_file"),
	playlistId: Schema.Null,
	mediaNodeId: MediaNode.MediaNodeId,
	playlistFillMode: Schema.Null,
	playbackMode: Schedule.BlockPlaybackMode,
	modeAfterPlayback: Schedule.ModeAfterPlayback,
	createdAt: Schema.String,
	updatedAt: Schema.String,
})

const PersistedTargetRow = Schema.Union(
	Schema.Struct({
		targetType: Schema.Literal("playlist"),
		playlistId: Playlist.PlaylistId,
		mediaNodeId: Schema.Null,
		playlistFillMode: Schedule.PlaylistFillMode,
	}),
	Schema.Struct({
		targetType: Schema.Literal("audio_file"),
		playlistId: Schema.Null,
		mediaNodeId: MediaNode.MediaNodeId,
		playlistFillMode: Schema.Null,
	}),
)

const EncodedScheduleTarget = Schema.encodedSchema(Schedule.ScheduleTarget)
const EncodedScheduleWeeklyBlock = Schema.encodedSchema(Schedule.ScheduleWeeklyBlock)
const EncodedScheduleOneOffBlock = Schema.encodedSchema(Schedule.ScheduleOneOffBlock)

const PersistedScheduleTarget = Schema.transformOrFail(PersistedTargetRow, EncodedScheduleTarget, {
	strict: true,
	decode: (row) => Effect.succeed(row),
	encode: (target) => Effect.succeed(target),
}).pipe(Schema.compose(Schedule.ScheduleTarget))

const PersistedWeeklyBlockRow = Schema.Union(
	PersistedWeeklyPlaylistRow,
	PersistedWeeklyAudioFileRow,
)

const PersistedOneOffPlaylistRow = Schema.Struct({
	id: Schedule.ScheduleOneOffBlockId,
	radioId: Radio.RadioId,
	startsAt: Schema.String,
	endsAt: Schema.String,
	targetType: Schema.Literal("playlist"),
	playlistId: Playlist.PlaylistId,
	mediaNodeId: Schema.Null,
	playlistFillMode: Schedule.PlaylistFillMode,
	playbackMode: Schedule.BlockPlaybackMode,
	modeAfterPlayback: Schedule.ModeAfterPlayback,
	createdAt: Schema.String,
	updatedAt: Schema.String,
})

const PersistedOneOffAudioFileRow = Schema.Struct({
	id: Schedule.ScheduleOneOffBlockId,
	radioId: Radio.RadioId,
	startsAt: Schema.String,
	endsAt: Schema.String,
	targetType: Schema.Literal("audio_file"),
	playlistId: Schema.Null,
	mediaNodeId: MediaNode.MediaNodeId,
	playlistFillMode: Schema.Null,
	playbackMode: Schedule.BlockPlaybackMode,
	modeAfterPlayback: Schedule.ModeAfterPlayback,
	createdAt: Schema.String,
	updatedAt: Schema.String,
})

const PersistedOneOffBlockRow = Schema.Union(
	PersistedOneOffPlaylistRow,
	PersistedOneOffAudioFileRow,
)

const PersistedWeeklyBlock = Schema.transformOrFail(
	PersistedWeeklyBlockRow,
	Schema.Struct({
		id: Schedule.ScheduleWeeklyBlockId,
		radioId: Radio.RadioId,
		weekday: Schedule.Weekday,
		startMinuteOfDay: Schedule.MinuteOfDay,
		endMinuteOfDay: Schedule.MinuteOfDay,
		target: EncodedScheduleTarget,
		playbackMode: Schedule.BlockPlaybackMode,
		modeAfterPlayback: Schedule.ModeAfterPlayback,
		createdAt: Schema.String,
		updatedAt: Schema.String,
	}),
	{
		strict: true,
		decode: (row) =>
			Schema.decodeUnknown(PersistedScheduleTarget)(row).pipe(
				Effect.map((target) => ({
					id: row.id,
					radioId: row.radioId,
					weekday: row.weekday,
					startMinuteOfDay: row.startMinuteOfDay,
					endMinuteOfDay: row.endMinuteOfDay,
					target,
					playbackMode: row.playbackMode,
					modeAfterPlayback: row.modeAfterPlayback,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
				})),
				Effect.mapError((error) => error.issue),
			),
		encode: (block) =>
			Schema.encode(PersistedScheduleTarget)(block.target).pipe(
				Effect.map((target) => ({
					id: block.id,
					radioId: block.radioId,
					weekday: block.weekday,
					startMinuteOfDay: block.startMinuteOfDay,
					endMinuteOfDay: block.endMinuteOfDay,
					...target,
					playbackMode: block.playbackMode,
					modeAfterPlayback: block.modeAfterPlayback,
					createdAt: block.createdAt,
					updatedAt: block.updatedAt,
				})),
				Effect.mapError((error) => error.issue),
			),
	},
).pipe(Schema.compose(Schedule.ScheduleWeeklyBlock))

const PersistedOneOffBlock = Schema.transformOrFail(
	PersistedOneOffBlockRow,
	Schema.Struct({
		id: Schedule.ScheduleOneOffBlockId,
		radioId: Radio.RadioId,
		startsAt: Schema.String,
		endsAt: Schema.String,
		target: EncodedScheduleTarget,
		playbackMode: Schedule.BlockPlaybackMode,
		modeAfterPlayback: Schedule.ModeAfterPlayback,
		createdAt: Schema.String,
		updatedAt: Schema.String,
	}),
	{
		strict: true,
		decode: (row) =>
			Schema.decodeUnknown(PersistedScheduleTarget)(row).pipe(
				Effect.map((target) => ({
					id: row.id,
					radioId: row.radioId,
					startsAt: row.startsAt,
					endsAt: row.endsAt,
					target,
					playbackMode: row.playbackMode,
					modeAfterPlayback: row.modeAfterPlayback,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
				})),
				Effect.mapError((error) => error.issue),
			),
		encode: (block) =>
			Schema.encode(PersistedScheduleTarget)(block.target).pipe(
				Effect.map((target) => ({
					id: block.id,
					radioId: block.radioId,
					startsAt: block.startsAt,
					endsAt: block.endsAt,
					...target,
					playbackMode: block.playbackMode,
					modeAfterPlayback: block.modeAfterPlayback,
					createdAt: block.createdAt,
					updatedAt: block.updatedAt,
				})),
				Effect.mapError((error) => error.issue),
			),
	},
).pipe(Schema.compose(Schedule.ScheduleOneOffBlock))

const repositoryError = (operation: string) => (cause: unknown) =>
	new Schedule.ScheduleBlockRepositoryError({
		operation,
		message: Cause.pretty(Cause.die(cause)),
	})

const schemaRepositoryError = (operation: string) => (error: ParseResult.ParseError) =>
	new Schedule.ScheduleBlockRepositoryError({
		operation,
		message: error.message,
	})

const decodeWeekly = (row: WeeklyRow) =>
	Schema.decodeUnknown(PersistedWeeklyBlock)(row).pipe(
		Effect.mapError(schemaRepositoryError("decodeWeeklyBlock")),
	)
const encodeWeekly = (block: Schedule.ScheduleWeeklyBlock) =>
	Schema.encode(PersistedWeeklyBlock)(block).pipe(
		Effect.mapError(schemaRepositoryError("encodeWeeklyBlock")),
	)
const decodeOneOff = (row: OneOffRow) =>
	Schema.decodeUnknown(PersistedOneOffBlock)(row).pipe(
		Effect.mapError(schemaRepositoryError("decodeOneOffBlock")),
	)
const encodeOneOff = (block: Schedule.ScheduleOneOffBlock) =>
	Schema.encode(PersistedOneOffBlock)(block).pipe(
		Effect.mapError(schemaRepositoryError("encodeOneOffBlock")),
	)
const decodeUtcFromDate = (date: Date) =>
	Schema.decodeUnknown(Schema.DateTimeUtcFromDate)(date).pipe(
		Effect.mapError(schemaRepositoryError("decodeUtcFromDate")),
	)

const isWeeklyBlockId = (blockId: string): blockId is Schedule.ScheduleWeeklyBlockId =>
	blockId.startsWith(`${Schedule.scheduleWeeklyBlockIdPrefix}_`)

const isOneOffBlockId = (blockId: string): blockId is Schedule.ScheduleOneOffBlockId =>
	blockId.startsWith(`${Schedule.scheduleOneOffBlockIdPrefix}_`)

export const ScheduleBlockRepositoryLive = Layer.effect(
	ScheduleBlockRepository,
	Effect.gen(function* () {
		const db = yield* Drizzle

		const listWeeklyBlocks: ScheduleBlockRepositoryShape["listWeeklyBlocks"] = (radioId) =>
			Effect.tryPromise({
				try: () =>
					db.select().from(scheduleWeeklyBlocks).where(eq(scheduleWeeklyBlocks.radioId, radioId)),
				catch: repositoryError("listWeeklyBlocks"),
			}).pipe(Effect.flatMap((rows) => Effect.forEach(rows, decodeWeekly)))

		const listOneOffBlocks: ScheduleBlockRepositoryShape["listOneOffBlocks"] = ({
			radioId,
			cursor,
			limit,
		}) =>
			Effect.tryPromise({
				try: () =>
					db
						.select()
						.from(scheduleOneOffBlocks)
						.where(
							cursor == null
								? eq(scheduleOneOffBlocks.radioId, radioId)
								: and(
										eq(scheduleOneOffBlocks.radioId, radioId),
										gt(scheduleOneOffBlocks.id, cursor),
									),
						)
						.limit(limit),
				catch: repositoryError("listOneOffBlocks"),
			}).pipe(Effect.flatMap((rows) => Effect.forEach(rows, decodeOneOff)))

		const listAllBlocks: ScheduleBlockRepositoryShape["listAllBlocks"] = (radioId) =>
			Effect.all({
				weekly: listWeeklyBlocks(radioId),
				oneOff: listOneOffBlocks({ radioId, limit: 10_000 }),
			})

		const getBlock: ScheduleBlockRepositoryShape["getBlock"] = (radioId, blockId) =>
			isWeeklyBlockId(blockId)
				? Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(scheduleWeeklyBlocks)
								.where(
									and(
										eq(scheduleWeeklyBlocks.radioId, radioId),
										eq(scheduleWeeklyBlocks.id, blockId),
									),
								),
						catch: repositoryError("getWeeklyBlock"),
					}).pipe(
						Effect.flatMap((rows) =>
							rows[0] == null
								? Effect.succeed<Schedule.ScheduleBlock | null>(null)
								: decodeWeekly(rows[0]).pipe(
										Effect.map((block) => ({ ...block, blockKind: "weekly" as const })),
									),
						),
					)
				: isOneOffBlockId(blockId)
					? Effect.tryPromise({
							try: () =>
								db
									.select()
									.from(scheduleOneOffBlocks)
									.where(
										and(
											eq(scheduleOneOffBlocks.radioId, radioId),
											eq(scheduleOneOffBlocks.id, blockId),
										),
									),
							catch: repositoryError("getOneOffBlock"),
						}).pipe(
							Effect.flatMap((rows) =>
								rows[0] == null
									? Effect.succeed<Schedule.ScheduleBlock | null>(null)
									: decodeOneOff(rows[0]).pipe(
											Effect.map((block) => ({ ...block, blockKind: "one-off" as const })),
										),
							),
						)
					: Effect.succeed(null)

		const insertBlock: ScheduleBlockRepositoryShape["insertBlock"] = (radioId, block) =>
			Effect.gen(function* () {
				const now = yield* Effect.sync(() => new Date())
				if (block.blockKind === "weekly") {
					const id = Id.random(Schedule.scheduleWeeklyBlockIdPrefix)
					const persisted = yield* encodeWeekly({
						...block,
						id,
						radioId,
						createdAt: yield* decodeUtcFromDate(now),
						updatedAt: yield* decodeUtcFromDate(now),
					})
					yield* Effect.tryPromise({
						try: () => db.insert(scheduleWeeklyBlocks).values(persisted),
						catch: repositoryError("insertWeeklyBlock"),
					})
					const decoded = yield* decodeWeekly(persisted)
					return { ...decoded, blockKind: "weekly" as const }
				}

				const id = Id.random(Schedule.scheduleOneOffBlockIdPrefix)
				const persisted = yield* encodeOneOff({
					...block,
					id,
					radioId,
					createdAt: yield* decodeUtcFromDate(now),
					updatedAt: yield* decodeUtcFromDate(now),
				})
				yield* Effect.tryPromise({
					try: () => db.insert(scheduleOneOffBlocks).values(persisted),
					catch: repositoryError("insertOneOffBlock"),
				})
				const decoded = yield* decodeOneOff(persisted)
				return { ...decoded, blockKind: "one-off" as const }
			})

		const updateBlock: ScheduleBlockRepositoryShape["updateBlock"] = (radioId, block) =>
			Effect.gen(function* () {
				const now = yield* Effect.sync(() => new Date())
				if (block.blockKind === "weekly") {
					const persisted = yield* encodeWeekly({
						...block,
						updatedAt: yield* decodeUtcFromDate(now),
					})
					const { id: _id, radioId: _radioId, createdAt: _createdAt, ...changes } = persisted
					yield* Effect.tryPromise({
						try: () =>
							db
								.update(scheduleWeeklyBlocks)
								.set(changes)
								.where(
									and(
										eq(scheduleWeeklyBlocks.radioId, radioId),
										eq(scheduleWeeklyBlocks.id, block.id),
									),
								),
						catch: repositoryError("updateWeeklyBlock"),
					})
					const decoded = yield* decodeWeekly(persisted)
					return { ...decoded, blockKind: "weekly" as const }
				} else {
					const persisted = yield* encodeOneOff({
						...block,
						updatedAt: yield* decodeUtcFromDate(now),
					})
					const { id: _id, radioId: _radioId, createdAt: _createdAt, ...changes } = persisted
					yield* Effect.tryPromise({
						try: () =>
							db
								.update(scheduleOneOffBlocks)
								.set(changes)
								.where(
									and(
										eq(scheduleOneOffBlocks.radioId, radioId),
										eq(scheduleOneOffBlocks.id, block.id),
									),
								),
						catch: repositoryError("updateOneOffBlock"),
					})
					const decoded = yield* decodeOneOff(persisted)
					return { ...decoded, blockKind: "one-off" as const }
				}
			})

		const deleteBlock: ScheduleBlockRepositoryShape["deleteBlock"] = (radioId, blockId) =>
			isWeeklyBlockId(blockId)
				? Effect.tryPromise({
						try: () =>
							db
								.delete(scheduleWeeklyBlocks)
								.where(
									and(
										eq(scheduleWeeklyBlocks.radioId, radioId),
										eq(scheduleWeeklyBlocks.id, blockId),
									),
								),
						catch: repositoryError("deleteWeeklyBlock"),
					}).pipe(Effect.asVoid)
				: isOneOffBlockId(blockId)
					? Effect.tryPromise({
							try: () =>
								db
									.delete(scheduleOneOffBlocks)
									.where(
										and(
											eq(scheduleOneOffBlocks.radioId, radioId),
											eq(scheduleOneOffBlocks.id, blockId),
										),
									),
							catch: repositoryError("deleteOneOffBlock"),
						}).pipe(Effect.asVoid)
					: Effect.void

		return {
			listWeeklyBlocks,
			listOneOffBlocks,
			listAllBlocks,
			getBlock,
			insertBlock,
			updateBlock,
			deleteBlock,
		}
	}),
)
