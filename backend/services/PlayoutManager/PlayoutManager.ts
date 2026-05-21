import { type Radio } from "@radiant/client"
import { Duration, Effect, Fiber, HashMap, Metric, Option, Ref, Schema, Stream } from "effect"

import type * as AudioMultiplexer from "../AudioMultiplexer"
import { RedisPubSub, type RedisPubSubMessage } from "../RedisService/RedisPubSub"
import { radioMetric, radioPlayoutSyncsTotal } from "../RadioManager/metrics"
import {
	scheduleBlocksChangedChannel,
	ScheduleBlockMutationNotificationJson,
} from "../ScheduleBlockService"
import * as PlayoutRuntime from "./PlayoutRuntime"
import { applyCurrentPlanToMultiplexer, resolveTimelineSnapshot } from "./resolver"

const scheduleResyncDebounce = Duration.millis(250)

export class PlayoutManager extends Effect.Service<PlayoutManager>()("PlayoutManager", {
	accessors: true,
	scoped: Effect.gen(function* () {
		const redisPubSub = yield* RedisPubSub
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
		const resyncDebounceFibersRef = yield* Ref.make(
			HashMap.empty<Radio.RadioId, Fiber.RuntimeFiber<void, never>>(),
		)

		const clearScheduledResync = (radioId: Radio.RadioId) =>
			Ref.update(resyncDebounceFibersRef, HashMap.remove(radioId))

		const interruptScheduledResync = (radioId: Radio.RadioId) =>
			Effect.gen(function* () {
				const existing = yield* Ref.modify(resyncDebounceFibersRef, (fibers) => [
					HashMap.get(fibers, radioId),
					HashMap.remove(fibers, radioId),
				])
				if (Option.isSome(existing)) {
					yield* Fiber.interrupt(existing.value).pipe(Effect.ignoreLogged)
				}
			})

		const resyncActiveRuntime = (radioId: Radio.RadioId) =>
			Effect.gen(function* () {
				const runtime = yield* Ref.get(runtimesRef).pipe(
					Effect.map((runtimes) => HashMap.get(runtimes, radioId)),
				)
				if (Option.isSome(runtime)) {
					yield* runtime.value.resync.pipe(
						Effect.tap(() =>
							Effect.logInfo("playout.runtime.resynced_from_schedule_event").pipe(
								Effect.annotateLogs({ radioId }),
							),
						),
					)
				}
			})

		const scheduleDebouncedResync = (radioId: Radio.RadioId) =>
			Effect.gen(function* () {
				yield* interruptScheduledResync(radioId)
				const fiber = yield* Effect.sleep(scheduleResyncDebounce).pipe(
					Effect.zipRight(clearScheduledResync(radioId)),
					Effect.zipRight(resyncActiveRuntime(radioId)),
					Effect.catchAllCause(Effect.logError),
					Effect.forkDaemon,
				)
				yield* Ref.update(resyncDebounceFibersRef, HashMap.set(radioId, fiber))
			})

		const notifications = yield* redisPubSub.subscribe(scheduleBlocksChangedChannel)
		yield* Stream.fromQueue<RedisPubSubMessage>(notifications, { shutdown: false }).pipe(
			Stream.mapEffect((event) =>
				Schema.decode(ScheduleBlockMutationNotificationJson)(event.message).pipe(
					Effect.tapError((error) =>
						Effect.logWarning("playout.schedule_event_decode_failed").pipe(
							Effect.annotateLogs({
								channel: event.channel,
								error: String(error),
							}),
						),
					),
				),
			),
			Stream.catchAll(() => Stream.empty),
			Stream.runForEach((event) => scheduleDebouncedResync(event.radioId)),
			Effect.forkScoped,
		)

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
						Effect.zipRight(interruptScheduledResync(radioId)),
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
