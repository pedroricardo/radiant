import { type Radio } from "@radiant/client"
import { DateTime, Duration, Effect, Fiber, Option, pipe, Ref } from "effect"

import type * as AudioMultiplexer from "../AudioMultiplexer"
import * as PlayoutState from "./PlayoutState"

export type RuntimeSnapshotResolver<E, R> = Effect.Effect<PlayoutState.TimelineSnapshot, E, R>

export type ApplyCurrentPlan<E, R> = (plan: PlayoutState.CurrentPlan) => Effect.Effect<void, E, R>

export type PlayoutRuntime<ResolveE, ResolveR, ApplyE, ApplyR> = {
	readonly radioId: Radio.RadioId
	readonly start: Effect.Effect<void, ResolveE | ApplyE, ResolveR | ApplyR>
	readonly syncNow: Effect.Effect<void, ResolveE | ApplyE, ResolveR | ApplyR>
	readonly advance: Effect.Effect<void, ResolveE | ApplyE, ResolveR | ApplyR>
	readonly resync: Effect.Effect<void, ResolveE | ApplyE, ResolveR | ApplyR>
	readonly stop: Effect.Effect<void, never, never>
	readonly snapshot: Effect.Effect<PlayoutState.State, never, never>
}

const interruptScheduledAdvance = (
	scheduledAdvanceFiberRef: Ref.Ref<Option.Option<Fiber.RuntimeFiber<void, never>>>,
	radioId: Radio.RadioId,
) =>
	Effect.gen(function* () {
		const existing = yield* Ref.getAndSet(scheduledAdvanceFiberRef, Option.none())
		if (Option.isSome(existing)) {
			yield* Effect.logDebug("playout.runtime.advance_interrupting").pipe(
				Effect.annotateLogs({ radioId }),
			)
			yield* Fiber.interrupt(existing.value).pipe(Effect.ignoreLogged)
		}
	})

const interpretCommands = Effect.fn("PlayoutRuntime.interpretCommands")(function* <
	ApplyE,
	ApplyR,
	AdvanceE,
	AdvanceR,
>(args: {
	readonly radioId: Radio.RadioId
	readonly commands: ReadonlyArray<PlayoutState.Command>
	readonly multiplexer: AudioMultiplexer.AudioMultiplexer
	readonly scheduledAdvanceFiberRef: Ref.Ref<Option.Option<Fiber.RuntimeFiber<void, never>>>
	readonly applyCurrentPlan: ApplyCurrentPlan<ApplyE, ApplyR>
	readonly onAdvance: Effect.Effect<void, AdvanceE, AdvanceR>
}) {
	for (const command of args.commands) {
		yield* Effect.logDebug("playout.runtime.interpreting_command").pipe(
			Effect.annotateLogs({
				radioId: args.radioId,
				command: command._tag,
				scheduledAt: "at" in command ? DateTime.toEpochMillis(command.at) : null,
			}),
		)
		switch (command._tag) {
			case "ApplyCurrentPlan":
				yield* args.applyCurrentPlan(command.plan).pipe(
					Effect.tap(() =>
						Effect.logInfo("playout.runtime.cluster_applied").pipe(
							Effect.annotateLogs({
								radioId: args.radioId,
								planType: command.plan._tag,
							}),
						),
					),
				)
				break
			case "ScheduleAdvanceAt": {
				yield* interruptScheduledAdvance(args.scheduledAdvanceFiberRef, args.radioId)
				const now = yield* DateTime.now
				const delay = Duration.max(Duration.zero, DateTime.distance(now, command.at))
				yield* Effect.logDebug("playout.runtime.advance_scheduled").pipe(
					Effect.annotateLogs({
						radioId: args.radioId,
						delayMs: Duration.toMillis(delay),
						at: DateTime.toEpochMillis(command.at),
					}),
				)
				const fiber = yield* Effect.sleep(delay).pipe(
					Effect.zipRight(
						Effect.logDebug("playout.runtime.advance_wakeup").pipe(
							Effect.annotateLogs({
								radioId: args.radioId,
								at: DateTime.toEpochMillis(command.at),
							}),
						),
					),
					Effect.zipRight(Ref.set(args.scheduledAdvanceFiberRef, Option.none())),
					Effect.zipRight(args.onAdvance),
					Effect.catchAllCause(Effect.logError),
					Effect.forkDaemon,
				)
				yield* Ref.set(args.scheduledAdvanceFiberRef, Option.some(fiber))
				break
			}
			case "CancelScheduledAdvance":
				yield* interruptScheduledAdvance(args.scheduledAdvanceFiberRef, args.radioId)
				break
			case "Noop":
				break
		}
	}
})

export const make = <ResolveE, ResolveR, ApplyE, ApplyR>(args: {
	readonly radioId: Radio.RadioId
	readonly multiplexer: AudioMultiplexer.AudioMultiplexer
	readonly resolveSnapshot: RuntimeSnapshotResolver<ResolveE, ResolveR>
	readonly applyCurrentPlan: ApplyCurrentPlan<ApplyE, ApplyR>
}): Effect.Effect<PlayoutRuntime<ResolveE, ResolveR, ApplyE, ApplyR>> =>
	Effect.gen(function* () {
		const stateRef = yield* Ref.make(PlayoutState.make())
		const scheduledAdvanceFiberRef = yield* Ref.make<
			Option.Option<Fiber.RuntimeFiber<void, never>>
		>(Option.none())

		const runTransition = (
			kind: "bootstrap" | "advance" | "resync",
			transition: (
				state: PlayoutState.State,
				snapshot: PlayoutState.TimelineSnapshot,
			) => PlayoutState.TransitionResult,
		): Effect.Effect<void, ResolveE | ApplyE, ResolveR | ApplyR> =>
			Effect.gen(function* () {
				const previous = yield* Ref.get(stateRef)
				const snapshot = yield* args.resolveSnapshot
				const result = transition(previous, snapshot)
				yield* Ref.set(stateRef, result.state)
				yield* Effect.logDebug("playout.runtime.transition").pipe(
					Effect.annotateLogs({
						radioId: args.radioId,
						kind,
						oldCurrent: pipe(
							previous.current,
							Option.map((current) => current._tag),
							Option.getOrNull,
						),
						newCurrent: pipe(
							result.state.current,
							Option.map((current) => current._tag),
							Option.getOrNull,
						),
						oldNextAt: pipe(
							previous.next,
							Option.map((next) => DateTime.toEpochMillis(next.at)),
							Option.getOrNull,
						),
						newNextAt: pipe(
							result.state.next,
							Option.map((next) => DateTime.toEpochMillis(next.at)),
							Option.getOrNull,
						),
						commandCount: result.commands.length,
					}),
				)
				yield* interpretCommands({
					radioId: args.radioId,
					commands: result.commands,
					multiplexer: args.multiplexer,
					scheduledAdvanceFiberRef,
					applyCurrentPlan: args.applyCurrentPlan,
					onAdvance: runTransition("advance", PlayoutState.advance),
				})
			})

		const stop: Effect.Effect<void, never, never> = Effect.gen(function* () {
			const state = yield* Ref.get(stateRef)
			const result = PlayoutState.stop(state)
			yield* Ref.set(stateRef, result.state)
			for (const command of result.commands) {
				if (command._tag === "CancelScheduledAdvance") {
					yield* interruptScheduledAdvance(scheduledAdvanceFiberRef, args.radioId)
				}
			}
		}).pipe(Effect.orDie)

		return {
			radioId: args.radioId,
			start: Effect.logInfo("playout.runtime.starting").pipe(
				Effect.annotateLogs({ radioId: args.radioId }),
				Effect.zipRight(runTransition("bootstrap", PlayoutState.bootstrap)),
			),
			syncNow: runTransition("resync", PlayoutState.resync),
			advance: runTransition("advance", PlayoutState.advance),
			resync: Effect.logInfo("playout.runtime.resync").pipe(
				Effect.annotateLogs({ radioId: args.radioId }),
				Effect.zipRight(runTransition("resync", PlayoutState.resync)),
			),
			stop,
			snapshot: Ref.get(stateRef),
		}
	})
