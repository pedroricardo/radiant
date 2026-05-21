import type { Playout } from "@radiant/client/lib"
import { Effect, Either, Option, Runtime, Schema } from "effect"
import * as DateTime from "effect/DateTime"

import * as Prompter from "../../shared/Prompter"
import {
	formatLocalDate,
	LocalDate,
	OneOffStartInput,
	parseMinuteOfDay,
	zonedDateParts,
} from "../../shared/time"
import { promptAudioNode } from "../media-library/prompts"
import { fetchAudioNodes } from "../media-library/repository"
import { promptPlaylist } from "../playlists/prompts"
import { fetchPlaylists } from "../playlists/repository"
import type { RadioRow } from "../radios/repository"
import { resolveOneOffStartInput } from "./repository"
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
	{ value: "one-off", label: "One-off block" },
	{ value: "weekly", label: "Weekly block" },
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

const promptTarget = (radio: RadioRow, targetType: Playout.ScheduleTargetType) =>
	Effect.gen(function* () {
		if (targetType === "audio_file") {
			const nodes = yield* fetchAudioNodes(radio.id)
			const mediaNodeId = yield* promptAudioNode(radio, nodes)
			const row = nodes.find((node) => node.media_nodes.id === mediaNodeId)!

			return {
				targetType,
				mediaNodeId,
				playlistId: null,
				durationMs: row.media_node_audio_metadata.durationMs,
			} as BlockTargetSelection
		}

		const rows = yield* fetchPlaylists(radio.id)
		const playlistId = yield* promptPlaylist(radio, rows)

		return {
			targetType,
			mediaNodeId: null,
			playlistId,
			durationMs: null,
		} as BlockTargetSelection
	})

export const promptBlockDraft = (radio: RadioRow) =>
	Effect.gen(function* () {
		const prompter = yield* Prompter.Prompter
		const runtime = yield* Effect.runtime()
		const now = yield* DateTime.now
		const zonedNow = DateTime.setZone(now, DateTime.zoneUnsafeMakeNamed(radio.timezone))
		const today = formatLocalDate(zonedDateParts(zonedNow))
		const runValidation = <A, E>(effect: Effect.Effect<A, E, never>) =>
			Runtime.runSync(runtime)(effect)

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

			const startMinuteOfDay = parseMinuteOfDay(startTime)!
			const endMinuteOfDay =
				target.targetType === "audio_file"
					? (() => {
							const durationMs = target.durationMs
							const durationMinutes = Math.max(1, Math.ceil(durationMs / 60_000))
							return (startMinuteOfDay + durationMinutes) % (24 * 60)
						})()
					: yield* prompter
							.text({
								message: "End time (HH:mm)",
								placeholder: "15:00",
								validate: (value) => {
									const endMinute = parseMinuteOfDay(value ?? "")

									if (endMinute == null) {
										return "Use HH:mm in 24-hour format."
									}

									if (endMinute <= startMinuteOfDay) {
										return "End time must be after start time in this first CLI version."
									}

									return undefined
								},
							})
							.pipe(Effect.map((value) => parseMinuteOfDay(value)!))

			return {
				blockKind,
				target,
				playbackMode,
				playlistFillMode,
				weekday,
				startMinuteOfDay,
				endMinuteOfDay,
			} satisfies BlockDraft
		}

		const date = yield* prompter.text({
			message: `Local date in ${radio.timezone} (YYYY-MM-DD)`,
			placeholder: "2026-05-16",
			initialValue: today,
			validate: (value) =>
				runValidation(
					Effect.gen(function* () {
						if (!value) {
							return undefined
						}
						const parsedDate = Schema.decodeUnknownOption(LocalDate)(value ?? "")
						return Option.isNone(parsedDate) ? "Use YYYY-MM-DD." : undefined
					}),
				),
		})

		const startTime = yield* prompter.text({
			message: 'Start time (HH:mm, +00:01, +1m, +30s, next)',
			placeholder: "14:00 or next",
			validate: (value) =>
				runValidation(
					Effect.gen(function* () {
						if ((value ?? "").trim().toLowerCase() === "next") {
							return undefined
						}

						const parsedStart = yield* Effect.either(
							Schema.decodeUnknown(OneOffStartInput)({
								timeZone: radio.timezone,
								dateInput: date,
								startInput: value ?? "",
							}),
						)

						return Either.isLeft(parsedStart)
							? 'Use HH:mm, "next", or a relative offset like +00:01, +1m, +30s.'
							: undefined
					}),
				),
		})

		const resolvedStart = yield* resolveOneOffStartInput(radio, date, startTime)

		const endMinuteOfDay =
			target.targetType === "audio_file"
				? null
				: yield* prompter
						.text({
							message: "End time (HH:mm)",
							placeholder: "15:00",
							validate: (value) => {
								const endMinute = parseMinuteOfDay(value ?? "")

								if (endMinute == null) {
									return "Use HH:mm in 24-hour format."
								}

								if (
									formatLocalDate(resolvedStart.date) === date &&
									endMinute <= resolvedStart.startMinuteOfDay
								) {
									return "End time must be after start time on the same day in this first CLI version."
								}

								return undefined
							},
						})
						.pipe(Effect.map((value) => parseMinuteOfDay(value)!))

		return {
			blockKind,
			target,
			playbackMode,
			playlistFillMode,
			startsAt: resolvedStart.startsAt,
			date: resolvedStart.date,
			startMinuteOfDay: resolvedStart.startMinuteOfDay,
			endMinuteOfDay,
		} satisfies BlockDraft
	})
