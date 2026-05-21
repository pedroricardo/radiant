import { expect } from "bun:test"
import { DateTime, Duration, Effect, Layer, Option, Ref, TestClock } from "effect"
import { MediaNode, Radio } from "@radiant/client"

import { it } from "../../bun-test-effect"
import * as AudioSource from "../../lib/AudioSource"
import { makeServiceSpy } from "../../test/support/serviceSpy"
import type { ServiceSpyCall } from "../../test/support/serviceSpy"
import { AudioMultiplexer } from "../AudioMultiplexer"
import * as PlayoutRuntime from "./PlayoutRuntime"
import * as PlayoutState from "./PlayoutState"

const runtimeLayer = AudioMultiplexer.Default

const at = (iso: string) => DateTime.unsafeMake(iso)

const makeAudioPlan = (startsAtIso: string, endsAtIso: string): PlayoutState.AudioFilePlan => ({
	_tag: "AudioFile",
	blockId: startsAtIso,
	blockKind: "one-off",
	mediaNodeId: "media_1" as MediaNode.MediaNodeId,
	storageKey: "unused",
	playbackPosition: Duration.zero,
	startsAt: at(startsAtIso),
	endsAt: at(endsAtIso),
})

const waitForSetClusterCallCount = (
	callsRef: Ref.Ref<ReadonlyArray<ServiceSpyCall<typeof AudioMultiplexer.Service>>>,
	expectedCount: number,
): Effect.Effect<number> =>
	Effect.gen(function* () {
		const calls = (yield* Ref.get(callsRef)).filter((call) => call.method === "setCluster")
		if (calls.length >= expectedCount) {
			return calls.length
		}
		yield* Effect.yieldNow()
		return yield* waitForSetClusterCallCount(callsRef, expectedCount)
	})

it.layer(runtimeLayer)(({ scoped }) => {
	scoped("PlayoutRuntime bootstrap schedules the next transition fiber", () =>
		Effect.gen(function* () {
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))
			const multiplexer = yield* AudioMultiplexer
			const spy = makeServiceSpy(multiplexer)
			const runtime = yield* PlayoutRuntime.make({
				radioId: "radio_test" as Radio.RadioId,
				multiplexer: spy.service,
				resolveSnapshot: Effect.succeed({
					current: PlayoutState.CurrentPlan.Silence(),
					next: Option.some({
						at: at("2025-01-06T10:00:10Z"),
						plan: makeAudioPlan("2025-01-06T10:00:10Z", "2025-01-06T10:00:15Z"),
					}),
				}),
				applyCurrentPlan: (plan) =>
					Effect.gen(function* () {
						if (plan._tag === "Silence") {
							yield* spy.service.setCluster([])
							return
						}
						const source = yield* AudioSource.fromPCM([new Float32Array(2048)], 44_100)
						yield* spy.service.setCluster([{ id: "media_1", source }])
					}),
			})
			yield* runtime.start

			expect(yield* waitForSetClusterCallCount(spy.spy.calls, 1)).toBe(1)
			const snapshot = yield* runtime.snapshot
			expect(Option.isSome(snapshot.scheduledAdvanceAt)).toBe(true)
		}),
	)

	scoped("PlayoutRuntime automatically applies the next plan when the clock advances", () =>
		Effect.gen(function* () {
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))
			const multiplexer = yield* AudioMultiplexer
			const spy = makeServiceSpy(multiplexer)
			const audioPlan = makeAudioPlan("2025-01-06T10:00:10Z", "2025-01-06T10:00:15Z")
			const runtime = yield* PlayoutRuntime.make({
				radioId: "radio_test" as Radio.RadioId,
				multiplexer: spy.service,
				resolveSnapshot: Effect.gen(function* () {
					const now = yield* DateTime.now
					const nowMs = DateTime.toEpochMillis(now)
					if (nowMs < DateTime.toEpochMillis(audioPlan.startsAt)) {
						return {
							current: PlayoutState.CurrentPlan.Silence(),
							next: Option.some({
								at: audioPlan.startsAt,
								plan: audioPlan,
							}),
						} satisfies PlayoutState.TimelineSnapshot
					}
					if (nowMs < DateTime.toEpochMillis(audioPlan.endsAt)) {
						return {
							current: {
								...audioPlan,
								playbackPosition: DateTime.distanceDuration(audioPlan.startsAt, now),
							},
							next: Option.some({
								at: audioPlan.endsAt,
								plan: PlayoutState.CurrentPlan.Silence(),
							}),
						} satisfies PlayoutState.TimelineSnapshot
					}
					return {
						current: PlayoutState.CurrentPlan.Silence(),
						next: Option.none(),
					} satisfies PlayoutState.TimelineSnapshot
				}),
				applyCurrentPlan: (plan) =>
					Effect.gen(function* () {
						if (plan._tag === "Silence") {
							yield* spy.service.setCluster([])
							return
						}
						const source = yield* AudioSource.fromPCM([new Float32Array(2048)], 44_100)
						yield* spy.service.setCluster([{ id: "media_1", source }])
					}),
			})
			yield* runtime.start
			yield* TestClock.adjust("10 seconds")
			expect(yield* waitForSetClusterCallCount(spy.spy.calls, 2)).toBe(2)
		}),
	)

	scoped("PlayoutRuntime resync interrupts old scheduled fiber and replaces it", () =>
		Effect.gen(function* () {
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))
			const multiplexer = yield* AudioMultiplexer
			const spy = makeServiceSpy(multiplexer)
			const snapshotRef = yield* Ref.make<PlayoutState.TimelineSnapshot>({
				current: PlayoutState.CurrentPlan.Silence(),
				next: Option.some({
					at: at("2025-01-06T10:00:10Z"),
					plan: makeAudioPlan("2025-01-06T10:00:10Z", "2025-01-06T10:00:15Z"),
				}),
			})
			const runtime = yield* PlayoutRuntime.make({
				radioId: "radio_test" as Radio.RadioId,
				multiplexer: spy.service,
				resolveSnapshot: Ref.get(snapshotRef),
				applyCurrentPlan: (plan) => spy.service.setCluster(plan._tag === "Silence" ? [] : []),
			})
			yield* runtime.start
			yield* Ref.set(snapshotRef, {
				current: PlayoutState.CurrentPlan.Silence(),
				next: Option.some({
					at: at("2025-01-06T10:00:20Z"),
					plan: makeAudioPlan("2025-01-06T10:00:20Z", "2025-01-06T10:00:25Z"),
				}),
			})
			yield* runtime.resync
			const snapshot = yield* runtime.snapshot
			expect(
				Option.match(snapshot.scheduledAdvanceAt, {
					onNone: () => null,
					onSome: (scheduledAdvanceAt) => DateTime.toEpochMillis(scheduledAdvanceAt),
				}),
			).toBe(
				DateTime.toEpochMillis(at("2025-01-06T10:00:20Z")),
			)
		}),
	)

	scoped("PlayoutRuntime does not duplicate setCluster on semantically unchanged plan", () =>
		Effect.gen(function* () {
			yield* TestClock.setTime(new Date("2025-01-06T10:00:10Z"))
			const multiplexer = yield* AudioMultiplexer
			const spy = makeServiceSpy(multiplexer)
			const basePlan = makeAudioPlan("2025-01-06T10:00:10Z", "2025-01-06T10:00:15Z")
			const snapshotRef = yield* Ref.make<PlayoutState.TimelineSnapshot>({
				current: basePlan,
				next: Option.some({
					at: at("2025-01-06T10:00:15Z"),
					plan: PlayoutState.CurrentPlan.Silence(),
				}),
			})
			const runtime = yield* PlayoutRuntime.make({
				radioId: "radio_test" as Radio.RadioId,
				multiplexer: spy.service,
				resolveSnapshot: Ref.get(snapshotRef),
				applyCurrentPlan: (plan) => spy.service.setCluster(plan._tag === "Silence" ? [] : []),
			})
			yield* runtime.start
			yield* Ref.set(snapshotRef, {
				current: { ...basePlan, playbackPosition: Duration.seconds(3) },
				next: Option.some({
					at: at("2025-01-06T10:00:15Z"),
					plan: PlayoutState.CurrentPlan.Silence(),
				}),
			})
			yield* runtime.resync
			expect(yield* waitForSetClusterCallCount(spy.spy.calls, 1)).toBe(1)
		}),
	)

	scoped("PlayoutRuntime stop interrupts scheduled fiber cleanly", () =>
		Effect.gen(function* () {
			yield* TestClock.setTime(new Date("2025-01-06T10:00:00Z"))
			const multiplexer = yield* AudioMultiplexer
			const spy = makeServiceSpy(multiplexer)
			const runtime = yield* PlayoutRuntime.make({
				radioId: "radio_test" as Radio.RadioId,
				multiplexer: spy.service,
				resolveSnapshot: Effect.succeed({
					current: PlayoutState.CurrentPlan.Silence(),
					next: Option.some({
						at: at("2025-01-06T10:00:10Z"),
						plan: makeAudioPlan("2025-01-06T10:00:10Z", "2025-01-06T10:00:15Z"),
					}),
				}),
				applyCurrentPlan: (plan) => spy.service.setCluster(plan._tag === "Silence" ? [] : []),
			})
			yield* runtime.start
			yield* runtime.stop
			yield* TestClock.adjust("10 seconds")
			expect(yield* waitForSetClusterCallCount(spy.spy.calls, 1)).toBe(1)
		}),
	)
})
