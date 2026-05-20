import { Effect } from "effect"
import * as DateTime from "effect/DateTime"

import * as Drizzle from "@radiant/backend/services/Drizzle"
import { scheduleOneOffBlocks } from "@radiant/backend/services/Drizzle/schema/scheduleOneOffBlocks"
import { scheduleWeeklyBlocks } from "@radiant/backend/services/Drizzle/schema/scheduleWeeklyBlocks"
import { MediaLibraryService } from "@radiant/backend/services/MediaLibraryService"
import { Id, Playout } from "@radiant/client/lib"

import { makeZonedDateTime } from "../../shared/time"
import type { RadioRow } from "../radios/repository"
import { InsertOneOffBlockError, InsertWeeklyBlockError } from "./errors"
import type { BlockDraft } from "./types"

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
