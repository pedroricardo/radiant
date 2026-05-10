import { Effect } from "effect"

export class PlayoutManager extends Effect.Service<PlayoutManager>()("PlayoutManager", {
	accessors: true,
	effect: Effect.gen(function* () {
		return {}
	}),
}) {}
export const layer = PlayoutManager.Default
