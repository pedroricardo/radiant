import { Data, DateTime, Duration, Option } from "effect"

import { MediaNode } from "@radiant/client"

export type CurrentPlan = Data.TaggedEnum<{
	Silence: {}
	AudioFile: {
		readonly blockId: string
		readonly blockKind: "one-off" | "weekly"
		readonly mediaNodeId: MediaNode.MediaNodeId
		readonly storageKey: string
		readonly playbackPosition: Duration.Duration
		readonly startsAt: DateTime.Utc
		readonly endsAt: DateTime.Utc
	}
	Playlist: {
		readonly blockId: string
		readonly blockKind: "one-off" | "weekly"
		readonly startsAt: DateTime.Utc
		readonly endsAt: DateTime.Utc
	}
}>

export type SilencePlan = Extract<CurrentPlan, { readonly _tag: "Silence" }>

export type AudioFilePlan = Extract<CurrentPlan, { readonly _tag: "AudioFile" }>

export type PlaylistPlan = Extract<CurrentPlan, { readonly _tag: "Playlist" }>

export type NextPlan = {
	readonly at: DateTime.Utc
	readonly plan: CurrentPlan
}

export type TimelineSnapshot = {
	readonly current: CurrentPlan
	readonly next: Option.Option<NextPlan>
}

export type Command = Data.TaggedEnum<{
	ApplyCurrentPlan: {
		readonly plan: CurrentPlan
	}
	ScheduleAdvanceAt: {
		readonly at: DateTime.Utc
	}
	CancelScheduledAdvance: {}
	Noop: {}
}>

export type State = {
	readonly current: Option.Option<CurrentPlan>
	readonly next: Option.Option<NextPlan>
	readonly scheduledAdvanceAt: Option.Option<DateTime.Utc>
}

export type TransitionResult = {
	readonly state: State
	readonly commands: ReadonlyArray<Command>
}

export const CurrentPlan = Data.taggedEnum<CurrentPlan>()

export const Command = Data.taggedEnum<Command>()

const silencePlan: SilencePlan = CurrentPlan.Silence()

const isSameInstant = (
	left: Option.Option<DateTime.Utc>,
	right: Option.Option<DateTime.Utc>,
) =>
	left === right ||
	(Option.isSome(left) &&
		Option.isSome(right) &&
		DateTime.toEpochMillis(left.value) === DateTime.toEpochMillis(right.value))

const isSameCurrentIdentity = (
	left: Option.Option<CurrentPlan>,
	right: Option.Option<CurrentPlan>,
): boolean => {
	if (left === right) {
		return true
	}
	if (Option.isNone(left) || Option.isNone(right) || left.value._tag !== right.value._tag) {
		return false
	}
	if (left.value._tag === "Silence" || right.value._tag === "Silence") {
		return left.value._tag === right.value._tag
	}
	return left.value.blockId === right.value.blockId &&
		left.value.blockKind === right.value.blockKind &&
		DateTime.toEpochMillis(left.value.startsAt) === DateTime.toEpochMillis(right.value.startsAt) &&
		DateTime.toEpochMillis(left.value.endsAt) === DateTime.toEpochMillis(right.value.endsAt)
}


const reconcile = (state: State, snapshot: TimelineSnapshot): TransitionResult => {
	const nextState: State = {
		current: Option.some(snapshot.current),
		next: snapshot.next,
		scheduledAdvanceAt: Option.map(snapshot.next, (next) => next.at),
	}

	const commands: Command[] = []

	if (!isSameCurrentIdentity(state.current, Option.some(snapshot.current))) {
		commands.push(Command.ApplyCurrentPlan({ plan: snapshot.current }))
	}

	if (!isSameInstant(state.scheduledAdvanceAt, nextState.scheduledAdvanceAt)) {
		if (Option.isSome(state.scheduledAdvanceAt)) {
			commands.push(Command.CancelScheduledAdvance())
		}
		if (Option.isSome(nextState.scheduledAdvanceAt)) {
			commands.push(Command.ScheduleAdvanceAt({ at: nextState.scheduledAdvanceAt.value }))
		}
	}

	if (commands.length === 0) {
		commands.push(Command.Noop())
	}

	return {
		state: nextState,
		commands,
	}
}

export const make = (): State => ({
	current: Option.none(),
	next: Option.none(),
	scheduledAdvanceAt: Option.none(),
})

export const bootstrap = (state: State, snapshot: TimelineSnapshot): TransitionResult =>
	reconcile(state, snapshot)

export const advance = (state: State, snapshot: TimelineSnapshot): TransitionResult =>
	reconcile(state, snapshot)

export const resync = (state: State, snapshot: TimelineSnapshot): TransitionResult =>
	reconcile(state, snapshot)

export const stop = (state: State): TransitionResult => {
	const commands: Command[] = []
	if (Option.isSome(state.scheduledAdvanceAt)) {
		commands.push(Command.CancelScheduledAdvance())
	}
	return {
		state: make(),
		commands: commands.length === 0 ? [Command.Noop()] : commands,
	}
}

export const snapshot = (state: State): State => ({
	current: Option.orElse(state.current, () => Option.some(silencePlan)),
	next: state.next,
	scheduledAdvanceAt: state.scheduledAdvanceAt,
})
