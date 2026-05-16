import type { Playout } from "@radiant/client/lib"
import { Effect } from "effect"

import type { RadioRow } from "../radios/repository"
import { fetchAudioNodes } from "../media-library/repository"
import { promptAudioNode } from "../media-library/prompts"
import { fetchPlaylists } from "../playlists/repository"
import { promptPlaylist } from "../playlists/prompts"
import * as Prompter from "../../shared/Prompter"
import { parseIsoLocalDate, parseMinuteOfDay } from "../../shared/time"
import type { BlockDraft, BlockKind, BlockTargetSelection } from "./types"

const weekdayOptions = [
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
	{ value: 7, label: "Sunday" },
] as const

const blockKindOptions = [
	{ value: "weekly", label: "Weekly block" },
	{ value: "one-off", label: "One-off block" },
] as const

const targetTypeOptions = [
	{ value: "audio_file", label: "Audio file" },
	{ value: "playlist", label: "Playlist" },
] as const

const playbackModeOptions = [
	{ value: "continue", label: "Continue" },
	{ value: "restart", label: "Restart" },
] as const

const playlistFillModeOptions = [
	{ value: "once", label: "Once" },
	{ value: "loop", label: "Loop" },
] as const

const promptTarget = (
	radio: RadioRow,
	targetType: Playout.ScheduleTargetType,
) =>
	Effect.gen(function* () {
		if (targetType === "audio_file") {
			const nodes = yield* fetchAudioNodes(radio.id)
			const mediaNodeId = yield* promptAudioNode(radio, nodes)

			return {
				targetType,
				mediaNodeId,
				playlistId: null,
			} as BlockTargetSelection
		}

		const rows = yield* fetchPlaylists(radio.id)
		const playlistId = yield* promptPlaylist(radio, rows)

		return {
			targetType,
			mediaNodeId: null,
			playlistId,
		} as BlockTargetSelection
	})

export const promptBlockDraft = (radio: RadioRow) =>
	Effect.gen(function* () {
		const prompter = yield* Prompter.Prompter

		yield* prompter.intro("Radiant playout block wizard")

		const blockKind = yield* prompter.select<BlockKind>({
			message: "What kind of block do you want to create?",
			options: [...blockKindOptions],
		})

		const targetType = yield* prompter.select<Playout.ScheduleTargetType>({
			message: "What should the block target?",
			options: [...targetTypeOptions],
		})

		const target = yield* promptTarget(radio, targetType)

		const playbackMode = yield* prompter.select<Playout.BlockPlaybackMode>({
			message: "How should playback behave when the block starts?",
			options: [...playbackModeOptions],
			initialValue: "continue",
		})

		const playlistFillMode =
			targetType === "playlist"
				? yield* prompter.select<Playout.PlaylistFillMode>({
						message: "How should playlist filling behave?",
						options: [...playlistFillModeOptions],
						initialValue: "once",
					})
				: null

		if (blockKind === "weekly") {
			const weekday = yield* prompter.select<number>({
				message: "Which weekday should the block run on?",
				options: [...weekdayOptions],
			})

			const startTime = yield* prompter.text({
				message: "Start time (HH:mm)",
				placeholder: "14:00",
				validate: (value) =>
					parseMinuteOfDay(value ?? "") == null ? "Use HH:mm in 24-hour format." : undefined,
			})

			const endTime = yield* prompter.text({
				message: "End time (HH:mm)",
				placeholder: "15:00",
				validate: (value) => {
					const startMinute = parseMinuteOfDay(startTime)
					const endMinute = parseMinuteOfDay(value ?? "")

					if (endMinute == null) {
						return "Use HH:mm in 24-hour format."
					}

					if (startMinute != null && endMinute <= startMinute) {
						return "End time must be after start time in this first CLI version."
					}

					return undefined
				},
			})

			return {
				blockKind,
				target,
				playbackMode,
				playlistFillMode,
				weekday,
				startMinuteOfDay: parseMinuteOfDay(startTime)!,
				endMinuteOfDay: parseMinuteOfDay(endTime)!,
			} satisfies BlockDraft
		}

		const date = yield* prompter.text({
			message: `Local date in ${radio.timezone} (YYYY-MM-DD)`,
			placeholder: "2026-05-16",
			validate: (value) =>
				parseIsoLocalDate(value ?? "") == null ? "Use YYYY-MM-DD." : undefined,
		})

		const startTime = yield* prompter.text({
			message: "Start time (HH:mm)",
			placeholder: "14:00",
			validate: (value) =>
				parseMinuteOfDay(value ?? "") == null ? "Use HH:mm in 24-hour format." : undefined,
		})

		const endTime = yield* prompter.text({
				message: "End time (HH:mm)",
				placeholder: "15:00",
				validate: (value) => {
					const startMinute = parseMinuteOfDay(startTime)
					const endMinute = parseMinuteOfDay(value ?? "")

					if (endMinute == null) {
						return "Use HH:mm in 24-hour format."
					}

					if (startMinute != null && endMinute <= startMinute) {
						return "End time must be after start time on the same day in this first CLI version."
					}

					return undefined
				},
			})

		return {
			blockKind,
			target,
			playbackMode,
			playlistFillMode,
			date: parseIsoLocalDate(date)!,
			startMinuteOfDay: parseMinuteOfDay(startTime)!,
			endMinuteOfDay: parseMinuteOfDay(endTime)!,
		} satisfies BlockDraft
	})
