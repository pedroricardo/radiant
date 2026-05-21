import { MediaNode } from "@radiant/client"
import { expect } from "bun:test"
import { DateTime, Duration, Effect, Option } from "effect"

import { it } from "../../bun-test-effect"
import * as PlayoutState from "./PlayoutState"

const at = (iso: string) => DateTime.unsafeMake(iso)

const audioPlan = (args?: Partial<PlayoutState.AudioFilePlan>): PlayoutState.AudioFilePlan => ({
	_tag: "AudioFile",
	blockId: "sob_1",
	blockKind: "one-off",
	mediaNodeId: "media_1" as MediaNode.MediaNodeId,
	storageKey: "radio/media_1",
	playbackPosition: Duration.zero,
	startsAt: at("2025-01-06T10:00:10Z"),
	endsAt: at("2025-01-06T10:00:15Z"),
	...args,
})

it.effect("PlayoutState bootstrap from empty state into silence + next transition", () =>
	Effect.sync(() => {
		const result = PlayoutState.bootstrap(PlayoutState.make(), {
			current: PlayoutState.CurrentPlan.Silence(),
			next: Option.some({
				at: at("2025-01-06T10:00:10Z"),
				plan: audioPlan(),
			}),
		})

		expect(result.commands).toEqual([
			{ _tag: "ApplyCurrentPlan", plan: PlayoutState.CurrentPlan.Silence() },
			{ _tag: "ScheduleAdvanceAt", at: at("2025-01-06T10:00:10Z") },
		])
	}),
)

it.effect("PlayoutState bootstrap into active one-off block", () =>
	Effect.sync(() => {
		const plan = audioPlan({
			playbackPosition: Duration.seconds(2),
		})
		const result = PlayoutState.bootstrap(PlayoutState.make(), {
			current: plan,
			next: Option.some({
				at: at("2025-01-06T10:00:15Z"),
				plan: PlayoutState.CurrentPlan.Silence(),
			}),
		})

		expect(result.commands[0]).toEqual({ _tag: "ApplyCurrentPlan", plan })
		expect(result.commands[1]).toEqual({
			_tag: "ScheduleAdvanceAt",
			at: at("2025-01-06T10:00:15Z"),
		})
	}),
)

it.effect("PlayoutState advance shifts from current block to next block", () =>
	Effect.sync(() => {
		const initialState = {
			current: Option.some(audioPlan()),
			next: Option.some({
				at: at("2025-01-06T10:00:15Z"),
				plan: PlayoutState.CurrentPlan.Silence(),
			}),
			scheduledAdvanceAt: Option.some(at("2025-01-06T10:00:15Z")),
		}
		const result = PlayoutState.advance(initialState, {
			current: PlayoutState.CurrentPlan.Silence(),
			next: Option.none(),
		})

		expect(result.commands).toEqual([
			{ _tag: "ApplyCurrentPlan", plan: PlayoutState.CurrentPlan.Silence() },
			{ _tag: "CancelScheduledAdvance" },
		])
	}),
)

it.effect("PlayoutState resync with identical snapshot emits no meaningful commands", () =>
	Effect.sync(() => {
		const state = {
			current: Option.some(audioPlan()),
			next: Option.some({
				at: at("2025-01-06T10:00:15Z"),
				plan: PlayoutState.CurrentPlan.Silence(),
			}),
			scheduledAdvanceAt: Option.some(at("2025-01-06T10:00:15Z")),
		}
		const result = PlayoutState.resync(state, {
			current: audioPlan({
				playbackPosition: Duration.seconds(3),
			}),
			next: Option.some({
				at: at("2025-01-06T10:00:15Z"),
				plan: PlayoutState.CurrentPlan.Silence(),
			}),
		})

		expect(result.commands).toEqual([{ _tag: "Noop" }])
	}),
)

it.effect("PlayoutState resync with changed next block cancels and reschedules", () =>
	Effect.sync(() => {
		const state = {
			current: Option.some(PlayoutState.CurrentPlan.Silence()),
			next: Option.some({
				at: at("2025-01-06T10:00:15Z"),
				plan: audioPlan(),
			}),
			scheduledAdvanceAt: Option.some(at("2025-01-06T10:00:15Z")),
		}
		const result = PlayoutState.resync(state, {
			current: PlayoutState.CurrentPlan.Silence(),
			next: Option.some({
				at: at("2025-01-06T10:00:20Z"),
				plan: audioPlan({
					blockId: "sob_2",
					startsAt: at("2025-01-06T10:00:20Z"),
					endsAt: at("2025-01-06T10:00:25Z"),
				}),
			}),
		})

		expect(result.commands).toEqual([
			{ _tag: "CancelScheduledAdvance" },
			{ _tag: "ScheduleAdvanceAt", at: at("2025-01-06T10:00:20Z") },
		])
	}),
)

it.effect("PlayoutState stop emits cancel command and clears state", () =>
	Effect.sync(() => {
		const state = {
			current: Option.some(audioPlan()),
			next: Option.some({
				at: at("2025-01-06T10:00:15Z"),
				plan: PlayoutState.CurrentPlan.Silence(),
			}),
			scheduledAdvanceAt: Option.some(at("2025-01-06T10:00:15Z")),
		}
		const result = PlayoutState.stop(state)

		expect(result.state).toEqual(PlayoutState.make())
		expect(result.commands).toEqual([{ _tag: "CancelScheduledAdvance" }])
	}),
)
