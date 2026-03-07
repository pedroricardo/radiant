import { Effect, Stream } from "effect";

export class AudioMultiplexer extends Effect.Service<AudioMultiplexer>()("AudioMultiplexer", {
	effect: Effect.gen(function*() {
		return {}
	})
}) {}
