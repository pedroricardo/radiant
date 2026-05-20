import {
	Cause,
	Clock,
	Data,
	Duration,
	Effect,
	Exit,
	Fiber,
	Layer,
	Metric,
	Option,
	Queue,
	Ref,
	Scope,
	Stream,
} from "effect"
import type { Radio } from "../../lib"
import * as AudioSource from "../../lib/AudioSource"
import * as AudioMultiplexer from "../AudioMultiplexer"
import * as IcyEncoder from "../IcyEncoder"
import { PlayoutManager } from "../PlayoutManager"
import { RadioManagerConfig } from "./RadioManagerConfig"
import {
	radioListenerConnectionsActive,
	radioListenerConnectionsTotal,
	radioMetric,
	radioStartsTotal,
	radioStreamClonesTotal,
} from "./metrics"
type RadioStreamError = Effect.Effect.Error<ReturnType<typeof PlayoutManager.Service.takeover>>
type RadioStreamSubscriberId = number

type RadioStreamRuntime = {
	readonly sampleRate: number
	readonly channels: number
	readonly frameBufferCapacity: number
	readonly subscribe: Stream.Stream<Float32Array>
}

type RadioStreamState = {
	readonly nextSubscriberId: RadioStreamSubscriberId
	readonly frameWindow: ReadonlyArray<Float32Array>
	readonly subscribers: ReadonlyMap<RadioStreamSubscriberId, Queue.Enqueue<Float32Array>>
}

class RadioStream extends Data.TaggedClass("RadioStream")<{
	readonly radioId: Radio.RadioId
	readonly multiplexer: AudioMultiplexer.AudioMultiplexer // A fonte partilhada
	readonly runtime: RadioStreamRuntime
	readonly playoutManagerFiber: Fiber.RuntimeFiber<void, RadioStreamError>
}> {}

const TARGET_CLIENT_BUFFER: Duration.DurationInput = "30 seconds"

const frameBufferCapacityFrom = (frameDurationMs: number): number =>
	Math.max(1, Math.ceil(Duration.toMillis(TARGET_CLIENT_BUFFER) / frameDurationMs))

const appendFrameWindow = (
	frameWindow: ReadonlyArray<Float32Array>,
	frame: Float32Array,
	capacity: number,
): ReadonlyArray<Float32Array> => {
	if (capacity <= 1) {
		return [frame]
	}

	if (frameWindow.length < capacity) {
		return [...frameWindow, frame]
	}

	return [...frameWindow.slice(frameWindow.length - capacity + 1), frame]
}

/**
 * Builds the shared PCM runtime for one radio.
 *
 * This is the layer that turns the `AudioMultiplexer` from a plain frame source
 * into a hot, time-aware radio stream with bounded buffering semantics.
 *
 * Why this exists:
 *
 * - The multiplexer knows how to render the next PCM frame, but by itself it has
 *   no notion of "radio time". If a consumer keeps pulling, it will happily
 *   produce frames as fast as the CPU allows.
 * - The listeners should not pull the multiplexer directly, because each slow
 *   client would then distort timing or force us into unbounded buffering.
 * - The radio needs one shared clock and one shared cache, then each listener
 *   should attach to that shared runtime with its own bounded queue.
 *
 * High-level shape:
 *
 * ```text
 *                           shared per radio
 *
 *   AudioMultiplexer.outputUnsafe
 *               |
 *               v
 *      +---------------------+
 *      | producer fiber      |
 *      | - pulls PCM frames  |
 *      | - tracks wall time  |
 *      | - bursts up to 30s  |
 *      | - then paces itself |
 *      +----------+----------+
 *                 |
 *                 | publish(frame)
 *                 v
 *      +-----------------------------+
 *      | RadioStream state           |
 *      | - frameWindow: last ~30s    |
 *      | - subscribers: Map<id, q>   |
 *      +-------------+---------------+
 *                    |
 *        +-----------+-----------+
 *        |                       |
 *        v                       v
 *   Queue.sliding(...)      Queue.sliding(...)
 *   listener A              listener B
 *        |                       |
 *        v                       v
 *   Stream.fromQueue        Stream.fromQueue
 *        |                       |
 *        v                       v
 *   IcyEncoder A            IcyEncoder B
 * ```
 *
 * Timing model:
 *
 * - We measure how much audio has been produced in milliseconds:
 *   `framesProduced * frameDurationMs`.
 * - We compare that to wall clock time since the producer started.
 * - While the producer is less than 30 seconds ahead, it keeps filling the
 *   shared cache as fast as possible.
 * - Once it gets more than 30 seconds ahead, it sleeps just enough to stay near
 *   that target window.
 *
 * The result is deliberate:
 *
 * - A fresh listener can join and immediately receive buffered audio.
 * - The radio maintains a stable cache horizon instead of growing forever.
 * - The multiplexer is consumed once per radio, not once per client.
 *
 * Buffering model:
 *
 * - `frameWindow` is the shared rolling cache for the radio. It stores the most
 *   recent frames up to the 30-second capacity.
 * - Each listener gets its own `Queue.sliding(capacity)`.
 * - On subscribe, we first snapshot `frameWindow`, enqueue that snapshot into
 *   the listener queue, and only then expose `Stream.fromQueue(queue)`.
 *
 * Using `sliding` is intentional:
 *
 * - If a client is slightly slower than real time, we prefer dropping old PCM
 *   frames over accumulating RAM forever.
 * - This keeps the listener near the live edge instead of drifting arbitrarily
 *   far behind.
 *
 * Scope / lifecycle:
 *
 * - The producer fiber is started with `Effect.forkScoped`, so it lives for as
 *   long as the radio scope lives.
 * - Each subscriber queue installs a finalizer that removes it from the
 *   subscriber map and shuts the queue down.
 *
 * Step-by-step data flow:
 *
 * 1. `makeRuntime` receives one `AudioMultiplexer` instance for one radio.
 * 2. It derives the frame duration from `sampleRate` and `frameSamples`, then
 *    converts the fixed 30-second target into a frame capacity.
 * 3. It allocates `stateRef`, which holds:
 *    - `frameWindow`: the shared rolling PCM cache
 *    - `subscribers`: the active listener queues
 *    - `nextSubscriberId`: a simple counter for stable map keys
 * 4. It starts the producer fiber.
 * 5. The producer pulls one frame from `multiplexer.outputUnsafe`.
 * 6. That frame is appended to `frameWindow`, trimming the oldest frame if the
 *    window is already full.
 * 7. The same frame is offered to every active subscriber queue.
 * 8. The producer updates its notion of "audio time produced" and compares it
 *    with wall clock time.
 * 9. If the producer is more than 30 seconds ahead, it sleeps; otherwise it
 *    keeps pulling immediately.
 * 10. A new listener subscribes by creating a fresh sliding queue.
 * 11. During subscription, the runtime snapshots the current `frameWindow`,
 *     registers the queue in `subscribers`, and seeds that queue with the
 *     snapshot.
 * 12. From that point on, the listener receives:
 *     - the buffered frames from the snapshot
 *     - then the new live frames published by the producer
 *
 * How state moves over time:
 *
 * ```text
 * t0: radio starts
 *     frameWindow = []
 *     subscribers = {}
 *     producer begins pulling as fast as possible
 *
 * t1: warmup / burst phase
 *     frameWindow grows: [f0, f1, f2, ...]
 *     producer stays ahead of wall clock until ~30s of audio are cached
 *
 * t2: steady-state phase
 *     frameWindow is full
 *     on each new frame:
 *       drop oldest frame
 *       append newest frame
 *     window becomes a moving 30s slice:
 *       [f1200 ... f2350] -> [f1201 ... f2351] -> ...
 *
 * t3: listener joins late
 *     queueA is created
 *     queueA is seeded with the current 30s window
 *     listener starts slightly behind the live edge, but with safe buffer
 *
 * t4: listener is slow
 *     queueA reaches capacity
 *     because it is sliding, old frames are discarded
 *     queueA keeps the newest frames instead of growing without bound
 *
 * t5: listener disconnects
 *     finalizer removes queueA from subscribers
 *     queueA is shut down
 *     producer and other listeners continue unaffected
 * ```
 *
 * The important distinction is:
 *
 * - `frameWindow` is the radio-level shared cache.
 * - subscriber queues are per-listener delivery buffers.
 *
 * The shared cache answers "what should a new listener hear immediately?".
 * The subscriber queue answers "how do we decouple this particular client from
 * the live producer without unbounded memory growth?".
 *
 * In short: `makeRuntime` is the place where "a sequence of PCM frames" becomes
 * "a real-time shared radio stream with a 30-second cache and bounded
 * per-listener backpressure".
 */
const makeRuntime = (
	multiplexer: AudioMultiplexer.AudioMultiplexer,
	options?: { readonly radioId?: Radio.RadioId; readonly waitUntilReady?: Effect.Effect<void> },
): Effect.Effect<RadioStreamRuntime, never, Scope.Scope> =>
	Effect.gen(function* () {
		const { channels, frameSamples, sampleRate } = multiplexer.config
		const frameDurationMs = (frameSamples / sampleRate) * 1_000
		const frameBufferCapacity = frameBufferCapacityFrom(frameDurationMs)
		const targetBufferMs = Duration.toMillis(TARGET_CLIENT_BUFFER)
		const warmupLoggedRef = yield* Ref.make(false)

		const stateRef = yield* Ref.make<RadioStreamState>({
			nextSubscriberId: 0,
			frameWindow: [],
			subscribers: new Map(),
		})

		const publishFrame = (frame: Float32Array) =>
			Effect.gen(function* () {
				const subscribers = yield* Ref.modify(stateRef, (state) => {
					const nextState: RadioStreamState = {
						...state,
						frameWindow: appendFrameWindow(state.frameWindow, frame, frameBufferCapacity),
					}
					return [Array.from(nextState.subscribers.values()), nextState] as const
				})

				yield* Effect.forEach(subscribers, (queue) => Queue.offer(queue, frame), {
					discard: true,
				})
			})

		const producer = Effect.gen(function* () {
			if (options?.waitUntilReady != null) {
				yield* Effect.logDebug("radio_stream.waiting_for_playout_ready").pipe(
					Effect.annotateLogs({ radioId: options.radioId ?? null }),
				)
				yield* options.waitUntilReady
				yield* Effect.logDebug("radio_stream.playout_ready_released").pipe(
					Effect.annotateLogs({ radioId: options.radioId ?? null }),
				)
			}
			const startedAt = yield* Clock.currentTimeMillis
			const framesProducedRef = yield* Ref.make(0)
			yield* Effect.logInfo("radio_stream.producer_started").pipe(
				Effect.annotateLogs({
					sampleRate,
					channels,
					frameSamples,
					frameBufferCapacity,
					targetBufferMs,
				}),
			)

			yield* multiplexer.outputUnsafe.pipe(
				Stream.runForEachScoped((frame) =>
					Effect.gen(function* () {
						yield* publishFrame(frame)

						const framesProduced = yield* Ref.updateAndGet(framesProducedRef, (count) => count + 1)
						const producedAudioMs = framesProduced * frameDurationMs
						const elapsedMs = (yield* Clock.currentTimeMillis) - startedAt
						const aheadMs = producedAudioMs - elapsedMs
						if (aheadMs >= targetBufferMs) {
							const shouldLogWarmup = yield* Ref.getAndSet(warmupLoggedRef, true).pipe(
								Effect.map((alreadyLogged) => !alreadyLogged),
							)
							if (shouldLogWarmup) {
								yield* Effect.logInfo("radio_stream.warmup_completed").pipe(
									Effect.annotateLogs({
										framesProduced,
										producedAudioMs,
										elapsedMs,
										aheadMs,
									}),
								)
							}
						}

						if (aheadMs > targetBufferMs) {
							yield* Effect.sleep(Duration.millis(aheadMs - targetBufferMs))
						}
					}),
				),
			)
		}).pipe(
			Effect.onExit((exit) =>
				Effect.logDebug("radio_stream.producer_exit").pipe(
					Effect.annotateLogs({
						radioId: options?.radioId ?? null,
						exit: String(
							Exit.causeOption(exit).pipe(
								Option.match({
									onSome: Cause.pretty,
									onNone: () => "Success",
								}),
							),
						),
					}),
				),
			),
		)

		yield* Effect.forkScoped(producer)

		const subscribe: Stream.Stream<Float32Array> = Stream.unwrapScoped(
			Effect.gen(function* () {
				const queue = yield* Queue.sliding<Float32Array>(frameBufferCapacity)
				const { frameWindow, subscriberId } = yield* Ref.modify(stateRef, (state) => {
					const subscriberId = state.nextSubscriberId
					const subscribers = new Map(state.subscribers)
					subscribers.set(subscriberId, queue)

					return [
						{
							subscriberId,
							frameWindow: state.frameWindow,
						},
						{
							...state,
							nextSubscriberId: subscriberId + 1,
							subscribers,
						} satisfies RadioStreamState,
					] as const
				})

				yield* Effect.addFinalizer(() =>
					Ref.update(stateRef, (state) => {
						const subscribers = new Map(state.subscribers)
						subscribers.delete(subscriberId)
						return {
							...state,
							subscribers,
						}
					}).pipe(
						Effect.zipRight(
							Effect.logInfo("radio_stream.subscriber_disconnected").pipe(
								Effect.annotateLogs({ subscriberId }),
							),
						),
						Effect.zipRight(
							options?.radioId == null
								? Effect.void
								: Metric.incrementBy(
										radioMetric(radioListenerConnectionsActive, options.radioId),
										-1,
									),
						),
						Effect.zipRight(Queue.shutdown(queue)),
						Effect.orDie,
					),
				)

				yield* Effect.forEach(frameWindow, (frame) => Queue.offer(queue, frame), {
					discard: true,
				})
				yield* Effect.logInfo("radio_stream.subscriber_connected").pipe(
					Effect.annotateLogs({
						subscriberId,
						replayedFrames: frameWindow.length,
						frameBufferCapacity,
					}),
				)
				if (options?.radioId != null) {
					yield* Metric.increment(radioMetric(radioListenerConnectionsTotal, options.radioId))
					yield* Metric.increment(radioMetric(radioListenerConnectionsActive, options.radioId))
				}

				return Stream.fromQueue(queue, {
					shutdown: false,
				})
			}).pipe(Effect.withSpan("RadioStream.subscribe")),
		)

		return {
			sampleRate,
			channels,
			frameBufferCapacity,
			subscribe,
		}
	}).pipe(
		Effect.annotateLogs({
			sampleRate: multiplexer.config.sampleRate,
			channels: multiplexer.config.channels,
			frameSamples: multiplexer.config.frameSamples,
		}),
		Effect.withSpan("RadioStream.makeRuntime"),
	)

const startRadio = Effect.fn("RadioStream.startRadio")(function* (radioId: Radio.RadioId) {
	const config = yield* RadioManagerConfig
	const scope = yield* Scope.make()
	const playoutManager = yield* PlayoutManager
	const playoutReady = yield* Effect.makeLatch(false)
	yield* Effect.logInfo("radio_stream.starting").pipe(Effect.annotateLogs({ radioId }))
	// Criamos o Multiplexer dentro de um scope partilhado para o rádio
	const multiplexer = yield* AudioMultiplexer.AudioMultiplexer.pipe(
		Effect.provide(
			config.audioMultiplexerLayer.pipe(
				Layer.extendScope,
				Layer.provide(Layer.succeed(Scope.Scope, scope)),
			),
		),
	)
	const runtime = yield* makeRuntime(multiplexer, {
		radioId,
		waitUntilReady: playoutReady.await,
	}).pipe(Effect.provideService(Scope.Scope, scope))
	// Fibra que mantém o Playout Manager a correr (alimentando o multiplexer)
	const playoutManagerFiber = yield* playoutManager
		.takeover(radioId, multiplexer, {
			readyLatch: playoutReady,
		})
		.pipe(
			Effect.tapErrorCause(Effect.logFatal),
			Effect.onExit((e) => Scope.close(scope, e)),
			Effect.forkDaemon,
		)
	yield* Effect.logInfo("radio_stream.started").pipe(
		Effect.annotateLogs({
			radioId,
			sampleRate: runtime.sampleRate,
			channels: runtime.channels,
			frameBufferCapacity: runtime.frameBufferCapacity,
		}),
	)
	yield* Metric.increment(radioMetric(radioStartsTotal, radioId))

	return new RadioStream({
		radioId,
		multiplexer,
		runtime,
		playoutManagerFiber: playoutManagerFiber,
	})
})

/**
 * Cria um novo stream MP3 exclusivo para esta conexão HTTP.
 * Cada chamada gera um novo IcyEncoder com estado limpo.
 */
const cloneStream = (self: RadioStream, options: { kbps: number; title?: string }) =>
	Effect.gen(function* () {
		yield* Effect.logInfo("radio_stream.clone_stream").pipe(
			Effect.annotateLogs({
				radioId: self.radioId,
				kbps: options.kbps,
				hasTitle: options.title != null,
			}),
		)
		yield* Metric.increment(radioMetric(radioStreamClonesTotal, self.radioId))
		const encoder = yield* IcyEncoder.IcyEncoder
		const source = new AudioSource.AudioSource({
			sampleRate: self.runtime.sampleRate,
			channels: self.runtime.channels,
			stream: self.runtime.subscribe,
		})

		return yield* encoder.encode(source, {
			kbps: options.kbps,
			metadataTitle: options.title,
		})
	}).pipe(
		Effect.annotateLogs({ radioId: self.radioId }),
		Effect.withSpan("RadioStream.cloneStream"),
	)
const stop = (self: RadioStream) =>
	Fiber.interrupt(self.playoutManagerFiber).pipe(
		Effect.tap(() =>
			Effect.logInfo("radio_stream.stopped").pipe(Effect.annotateLogs({ radioId: self.radioId })),
		),
		Effect.annotateLogs({ radioId: self.radioId }),
		Effect.withSpan("RadioStream.stop"),
	)

export {
	cloneStream,
	makeRuntime,
	startRadio,
	stop,
	type RadioStreamError as Error,
	type RadioStream,
}
