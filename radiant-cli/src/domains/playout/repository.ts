import { DateTime, Effect } from "effect"

import { ScheduleBlockService } from "@radiant/backend/services/ScheduleBlockService"
import { Schedule } from "@radiant/client/lib"

import { makeZonedDateTime } from "../../shared/time"
import type { RadioRow } from "../radios/repository"
import { OverlappingBlockError } from "./errors"
import type { BlockDraft } from "./types"

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
