import type { Radio } from "$lib"
import { AudioMultiplexer, IcyEncoder } from "$services"
import { Data, Effect, Fiber, Layer, Scope } from "effect"
import { RadioManagerConfig } from "./RadioManagerConfig"

type RadioStreamError = AudioMultiplexer.MultiplexerError | IcyEncoder.EncodingError

class RadioStream extends Data.TaggedClass("RadioStream")<{
	readonly radioId: Radio.RadioId
	readonly multiplexer: AudioMultiplexer.AudioMultiplexer // A fonte partilhada
	readonly fiber: Fiber.RuntimeFiber<void, RadioStreamError>
}> {}

const startRadio = Effect.fn("RadioStream.startRadio")(function* (radioId: Radio.RadioId) {
	const config = yield* RadioManagerConfig
	const scope = yield* Scope.make()

	// Criamos o Multiplexer dentro de um scope partilhado para o rádio
	const multiplexer = yield* AudioMultiplexer.AudioMultiplexer.pipe(
		Effect.provide(
			config.audioMultiplexerLayer.pipe(
				Layer.extendScope,
				Layer.provide(Layer.succeed(Scope.Scope, scope)),
			),
		),
	)

	// Fibra que mantém o Playout Manager a correr (alimentando o multiplexer)
	const fiber = yield* Effect.gen(function* () {
		// TODO: dar o controlo ao PlayoutManager aqui
		yield* Effect.never // Mantém a fibra viva até ser interrompida
	}).pipe(
		Effect.onExit((e) => Scope.close(scope, e)),
		Effect.forkDaemon,
	)

	return new RadioStream({
		radioId,
		multiplexer,
		fiber,
	})
})

/**
 * Cria um novo stream MP3 exclusivo para esta conexão HTTP.
 * Cada chamada gera um novo IcyEncoder com estado limpo.
 */
const cloneStream = (self: RadioStream, options: { kbps: number; title?: string }) =>
	Effect.gen(function* () {
		const encoder = yield* IcyEncoder.IcyEncoder

		// Transformamos o multiplexer partilhado numa AudioSource
		const source = yield* self.multiplexer.asAudioSource

		// Criamos um novo processo de encoding para este ouvinte específico
		// Isso garante que o ouvinte receba os headers iniciais do MP3 e
		// que a contagem de bytes para metadados comece do zero.
		return yield* encoder.encode(source, {
			kbps: options.kbps,
			metadataTitle: options.title,
		})
	}).pipe(Effect.withSpan("RadioStream.cloneStream"))

const stop = (self: RadioStream) =>
	Fiber.interrupt(self.fiber).pipe(Effect.withSpan("RadioStream.stop"))

export { cloneStream, startRadio, stop, type RadioStreamError as Error, type RadioStream }
