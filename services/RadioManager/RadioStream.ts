import type { Radio } from "$lib"
import { AudioMultiplexer, IcyEncoder } from "$services"
import { Data, Deferred, Effect, Fiber, Scope, Stream } from "effect"
import { RadioManagerConfig } from "./RadioManagerConfig"
type RadioStreamError = AudioMultiplexer.MultiplexerError | IcyEncoder.EncodingError
class RadioStream extends Data.TaggedClass("RadioStream")<{
	readonly fiber: Fiber.RuntimeFiber<void, RadioStreamError>
	readonly encodedStream: Effect.Effect<IcyEncoder.ByteStream<RadioStreamError>>
	readonly radioId: Radio.RadioId
}> {}
const startRadio = Effect.fn("RadioStream.startRadio")(function* (radioId: Radio.RadioId) {
	const config = yield* RadioManagerConfig
	const deferredStream = yield* Deferred.make<
		IcyEncoder.ByteStream<RadioStreamError>,
		IcyEncoder.EncodingError
	>()
	const encoder = yield* IcyEncoder.IcyEncoder

	const fiber = yield* Effect.gen(function* () {
		const encodedStream = yield* encoder
			.encode(yield* AudioMultiplexer.AudioMultiplexer.asAudioSource, {
				kbps: 128,
			})
			.pipe(Effect.tapError((e) => Deferred.fail(deferredStream, e)))
		yield* Deferred.succeed(deferredStream, encodedStream)
		// TODO: give control to the playout manager service
	}).pipe(Effect.provide(config.audioMultiplexerLayer), Effect.forkScoped)
	const encodedStream = yield* deferredStream.pipe(Deferred.await)
	return new RadioStream({
		encodedStream: Stream.broadcastDynamic({
			capacity: "unbounded",
		})(encodedStream).pipe(Scope.extend(yield* Scope.Scope)),
		fiber,
		radioId,
	})
})
const stop = (self: RadioStream) =>
	Fiber.interrupt(self.fiber).pipe(Effect.withSpan("RadioStream.stop"), Effect.asVoid)

const cloneStream = (self: RadioStream) =>
	self.encodedStream.pipe(Effect.withSpan("RadioStream.cloneStream"))
export { cloneStream, startRadio, stop, type RadioStreamError as Error, type RadioStream }
