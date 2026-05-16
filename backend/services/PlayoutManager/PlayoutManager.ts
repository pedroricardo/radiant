import { AudioSource } from "@radiant/backend/lib"
import { MediaLibrary, MediaNode, Playout, type Playlist, type Radio } from "@radiant/client"
import type { ScheduleOneOffBlock, ScheduleWeeklyBlock } from "@radiant/client/lib/Playout"
import { eq } from "drizzle-orm"
import { Array, Console, Data, DateTime, Duration, Effect, Equal, Match, Option, pipe, Schema, Stream } from "effect"
import type { ParseError } from "effect/ParseResult"
import type { Simplify } from "effect/Types"
import assert from "node:assert/strict"
import type * as AudioMultiplexer from "../AudioMultiplexer"
import { Drizzle } from "../Drizzle"
import { scheduleOneOffBlocks } from "../Drizzle/schema/scheduleOneOffBlocks"
import { scheduleWeeklyBlocks } from "../Drizzle/schema/scheduleWeeklyBlocks"
import { MediaLibraryService } from "../MediaLibraryService"
import * as RadioManager from "../RadioManager"
import { StorageService } from "../StorageService"
type ScheduleBlock = Data.TaggedEnum<{
	OneOff: Playout.ScheduleOneOffBlock
	Weekly: Playout.ScheduleWeeklyBlock
}>
const ScheduleBlock = Data.taggedEnum<ScheduleBlock>()
// Represents the state of what should be playing right now at any time
type TimelineHit = Data.TaggedEnum<{
	// Nothing scheduled for the current system time
	Silence: {}
	// There's a song scheduled for the current system time
	AudioFile: {
		mediaNode: MediaNode.MediaNode
		playbackPosition: Duration.Duration
		block: Simplify<
			ScheduleBlock & { readonly targetType: "audio_file"; readonly playlistFillMode: null }
		>
	}
	// We hit a song inside a playlist
	Playlist: {
		mediaNode: MediaNode.MediaNode
		playbackPosition: Duration.Duration
		block: Simplify<
			ScheduleBlock & {
				readonly targetType: "playlist"
				readonly playlistFillMode: NonNullable<ScheduleBlock["playlistFillMode"]>
			}
		>
		playlist: Playlist.Playlist
		currentPlaylistItem: Playlist.PlaylistItem
		// The playlist is expected to have at least one item, otherwise the field above doesn't make sense
		playlistItems: [Playlist.PlaylistItem, ...Playlist.PlaylistItem[]]
	}
}>
const TimelineHit = Data.taggedEnum<TimelineHit>()
export class FetchBlocksError extends Data.TaggedError("FetchBlocksError")<{
	message: string
	cause: unknown
	radioId: Radio.RadioId
}> {}
export class FetchBlocksParseError extends Data.TaggedError("FetchBlocksParseError")<{
	message: string
	cause: ParseError
	radioId: Radio.RadioId
}> {}

export class FetchMediaNodeError extends Data.TaggedError("FetchMediaNodeError")<{
	message: string
	cause: MediaLibrary.MediaLibraryServiceError | MediaLibrary.MediaLibraryNodeNotFoundError
	radioId: Radio.RadioId
	mediaNodeId: MediaNode.MediaNodeId
}> {}

export class PlayoutManager extends Effect.Service<PlayoutManager>()("PlayoutManager", {
	accessors: true,
	effect: Effect.gen(function* () {
		const radioRepo = yield* RadioManager.RadioRepository
		const db = yield* Drizzle
		const mediaLibrary = yield* MediaLibraryService
		const storage = yield* StorageService
		const fetchBlocks = Effect.fn("PlayoutManager.fetchBlocks")(function* (radioId: Radio.RadioId) {
			// FIXME: Find a way to narrow the query down to filter out blocks that aren't even close to the current time to save bandwidth
			const { allOneOffBlocks, allWeeklyBlocks } = yield* Effect.all(
				{
					allOneOffBlocks: Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(scheduleOneOffBlocks)
								.where(eq(scheduleOneOffBlocks.radioId, radioId)),
						catch: (cause) =>
							new FetchBlocksError({
								message: "failed to fetch one off blocks from the schedule",
								cause,
								radioId,
							}),
					}).pipe(
						Effect.flatMap(Schema.decode(Schema.Array(Playout.ScheduleOneOffBlock))),
						Effect.withSpan("fetch all one off blocks"),
					),
					allWeeklyBlocks: Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(scheduleWeeklyBlocks)
								.where(eq(scheduleWeeklyBlocks.radioId, radioId)),
						catch: (cause) =>
							new FetchBlocksError({
								message: "failed to fetch weekly blocks from the schedule",
								cause,
								radioId,
							}),
					}).pipe(
						Effect.flatMap(Schema.decode(Schema.Array(Playout.ScheduleWeeklyBlock))),
						Effect.withSpan("fetch all weekly blocks"),
					),
				},
				{ concurrency: 2 },
			)

			const blocks: ScheduleBlock[] = [
				...allOneOffBlocks.map(ScheduleBlock.OneOff),
				...allWeeklyBlocks.map(ScheduleBlock.Weekly),
			]
			return blocks
		})

		const checkCollisionWithOneOffBlock = Effect.fn("checkCollisionWithOneOffBlock")(function* (
			block: ScheduleOneOffBlock,
			time: DateTime.Zoned,
		) {
			assert.ok(
				DateTime.lessThan(block.startsAt, block.endsAt),
				"DateTime.lessThan(block.startsAt, block.endsAt)",
			)

			const isInsideBlock =
				DateTime.greaterThanOrEqualTo(time, block.startsAt) && DateTime.lessThan(time, block.endsAt)
			yield* Effect.log("isInsideBlock = " + isInsideBlock)
			yield* Effect.log("DateTime.greaterThanOrEqualTo(time, block.startsAt)  = " + DateTime.greaterThanOrEqualTo(time, block.startsAt) )
			yield* Effect.log("DateTime.lessThan(time, block.endsAt) = " + DateTime.lessThan(time, block.endsAt) )
			yield* Effect.log("block = ", block)
			yield* Effect.log("time = ", time)
			if (!isInsideBlock) {
				return Option.none()
			}

			return yield* pipe(
				Match.value(block),
				Match.discriminatorsExhaustive("targetType")({
					audio_file: Effect.fn(function* () {
						const playbackPosition = DateTime.distanceDuration(block.startsAt, time)
						assert.notEqual(block.mediaNodeId, null)
						// TODO: batch media node queries
						const mediaNode = yield* mediaLibrary
							.getNode({ radioId: block.radioId, nodeId: block.mediaNodeId! })
							.pipe(
								Effect.mapError(
									(e) =>
										new FetchMediaNodeError({
											cause: e,
											message:
												"failed to fetch media node id " +
												block.mediaNodeId +
												" of block " +
												block.id +
												" from radio " +
												block.radioId,
											radioId: block.radioId,
											mediaNodeId: block.mediaNodeId!,
										}),
								),
							)
						assert.equal(block.playlistFillMode, null)
						assert.notEqual(mediaNode.durationMs, null)
						const actualEndsAt = DateTime.addDuration(block.startsAt, mediaNode.durationMs!);
						if(DateTime.greaterThanOrEqualTo(time, actualEndsAt)) {
							return Option.none();
						}
						return Option.some(
							TimelineHit.AudioFile({
								block: block as any,
								mediaNode,
								playbackPosition,
							}),
						)
					}),
					playlist: Effect.fn(function* () {
						return yield* Effect.die("todo")
					}),
				}),
			)
		})
		const checkCollisionWithWeeklyBlock = Effect.fn("checkCollisionWithWeeklyBlock")(function* (
			block: ScheduleWeeklyBlock,
			time: DateTime.Zoned,
		) {
			return Option.none()
		})
		const checkCollisionWithBlock = Effect.fn("checkCollisionWithBlock")(function* (
			block: ScheduleBlock,
			time: DateTime.Zoned,
		) {
			return yield* ScheduleBlock.$match({
				OneOff: (oneOff) => checkCollisionWithOneOffBlock(oneOff, time),
				Weekly: (weekly) => checkCollisionWithWeeklyBlock(weekly, time),
			})(block)
		})

		const findBlockCollidingWithTime = Effect.fn(function* (
			blocks: ScheduleBlock[],
			time: DateTime.Zoned,
		) {
			const collisionTestResults = (yield* Effect.forEach(
				blocks,
				(block) => checkCollisionWithBlock(block, time),
				{ concurrency: "unbounded" },
			)) as Option.Option<TimelineHit>[]
			return pipe(
				collisionTestResults,
				Array.findFirst(Option.isSome),
				Option.flatten,
				Option.getOrElse(TimelineHit.Silence),
			)
		})

		const syncNow = Effect.fn("PlayoutManager.syncNow")(function* (
			radioId: Radio.RadioId,
			multiplexer: AudioMultiplexer.AudioMultiplexer,
		) {
			const radio = yield* radioRepo.getRadioInfo(radioId)
			const blocks = yield* fetchBlocks(radioId)

			const now = pipe(
				yield* DateTime.now,
				DateTime.unsafeSetZoneNamed(radio.timezone, {
					adjustForTimeZone: true
				}),
			)

			const timelineHit = yield* findBlockCollidingWithTime(blocks, now)

			yield* pipe(
				Match.value(timelineHit),
				Match.tagsExhaustive({
					Silence: (_) => Effect.gen(function* () {
						yield* multiplexer.setCluster([])
					}),

					AudioFile: (hit) => Effect.gen(function* () {
						const storageKey = hit.mediaNode.storageKey
						assert.ok(storageKey); // Se é um ficheiro de audio, ele necessariamente vai ter um storageKey, se não tiver, o banco de dados tá corrompido
						const encodedAudioStream = (yield* storage.readObject(storageKey)).pipe(
						)

						const source = yield* AudioSource.fromEncodedAudioFileStream(encodedAudioStream, {
							seek: hit.playbackPosition,
						}).pipe(
							Effect.map(AudioSource.mapStream(Stream.timeout("3 seconds")))
						)
						console.log(hit)
						yield* multiplexer.setCluster([
							{
								id: hit.mediaNode.id,
								volume: 1.0,
								source: source,
							},
						])
					}),

					Playlist: (playlist) => Effect.gen(function* () {
						return yield* Effect.die("playlist takeover is not implemented yet")
					}),
				}),
			)
		})

		const takeover = Effect.fn("PlayoutManager.takeover")(function* (
			radioId: Radio.RadioId,
			multiplexer: AudioMultiplexer.AudioMultiplexer,
		) {
			return yield* Effect.never
		})
		return {
			syncNow,
			takeover,
		}
	}),
}) {}
export const layer = PlayoutManager.Default
