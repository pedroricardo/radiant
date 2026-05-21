import { type Radio } from "@radiant/client"
import { Effect, HashMap, Metric, Ref } from "effect"

import type * as AudioMultiplexer from "../AudioMultiplexer"
import {
	radioMetric,
	radioPlayoutSyncsTotal,
} from "../RadioManager/metrics"
import * as PlayoutRuntime from "./PlayoutRuntime"
import { applyCurrentPlanToMultiplexer, resolveTimelineSnapshot } from "./resolver"

export class PlayoutManager extends Effect.Service<PlayoutManager>()("PlayoutManager", {
	accessors: true,
	effect: Effect.gen(function* () {
		const makeRuntime = (radioId: Radio.RadioId, multiplexer: AudioMultiplexer.AudioMultiplexer) =>
			PlayoutRuntime.make({
				radioId,
				multiplexer,
				resolveSnapshot: resolveTimelineSnapshot(radioId).pipe(
					Effect.tap(() => Metric.increment(radioMetric(radioPlayoutSyncsTotal, radioId))),
				),
				applyCurrentPlan: (plan) => applyCurrentPlanToMultiplexer(radioId, multiplexer, plan),
			})
		type ManagedPlayoutRuntime = Effect.Effect.Success<ReturnType<typeof makeRuntime>>
		const runtimesRef = yield* Ref.make(HashMap.empty<Radio.RadioId, ManagedPlayoutRuntime>())

		const syncNow = Effect.fn("PlayoutManager.syncNow")(function* (
			radioId: Radio.RadioId,
			multiplexer: AudioMultiplexer.AudioMultiplexer,
		) {
			const runtime = yield* makeRuntime(radioId, multiplexer)
			yield* runtime.start
			yield* runtime.stop
		})

		const takeover = Effect.fn("PlayoutManager.takeover")(function* (
			radioId: Radio.RadioId,
			multiplexer: AudioMultiplexer.AudioMultiplexer,
			options?: {
				readonly readyLatch?: Effect.Latch
			},
		) {
			yield* Effect.annotateLogsScoped({ radioId })
			yield* Effect.logInfo("playout.takeover_started")
			const runtime = yield* makeRuntime(radioId, multiplexer)
			yield* Ref.update(runtimesRef, HashMap.set(radioId, runtime))
			yield* runtime.start
			yield* options?.readyLatch?.open ?? Effect.void
			yield* Effect.logInfo("playout.takeover_ready")
			yield* Effect.never.pipe(
				Effect.ensuring(
					runtime.stop.pipe(
						Effect.zipRight(Ref.update(runtimesRef, HashMap.remove(radioId))),
						Effect.exit,
						Effect.asVoid,
					),
				),
			)
		}, Effect.scoped)
		return {
			syncNow,
			takeover,
		}
	}),
}) {}
export const layer = PlayoutManager.Default
