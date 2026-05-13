import * as AudioSource from "../../lib/AudioSource"
import { Chunk, Duration, Effect, PubSub, Queue, Ref, Scope, Stream } from "effect"
import {
	DEFAULT_CHANNELS,
	DEFAULT_CROSSFADE_DURATION,
	DEFAULT_FRAME_SAMPLES,
	DEFAULT_SAMPLE_RATE,
} from "./constants"
import type { MultiplexerError } from "./Error"
import {
	MultiplexerCommandQueueError,
	MultiplexerInvalidCrossfadeDurationError,
	MultiplexerInvalidMasterVolumeError,
} from "./Error"
import * as internal from "./internal"
import { applyGain, crossfadeFrames, makeSilenceFrame } from "./internal/audio"
import {
	createRuntimeCluster,
	crossfadeSamples,
	renderClusterFrame,
	validateConfig,
	validateSourceInputs,
} from "./runtime"
import type { AudioMultiplexerConfig, MultiplexerSourceInput, MultiplexerState } from "./types"

export class AudioMultiplexer extends Effect.Service<AudioMultiplexer>()("AudioMultiplexer", {
	accessors: true,
	scoped: Effect.gen(function* () {
		const config: AudioMultiplexerConfig = {
			sampleRate: DEFAULT_SAMPLE_RATE,
			channels: DEFAULT_CHANNELS,
			frameSamples: DEFAULT_FRAME_SAMPLES,
			defaultCrossfadeDuration: DEFAULT_CROSSFADE_DURATION,
		}

		yield* validateConfig(config)

		const commandQueue = yield* Queue.unbounded<internal.Command>()
		const pullScope = yield* Scope.Scope

		const stateRef = yield* Ref.make<MultiplexerState>({
			nextClusterId: 1,
			activeCluster: null,
			fadingOutCluster: null,
			fadeProgressSamples: 0,
			fadeTotalSamples: 0,
			masterVolume: 1,
		})

		const frameLength = config.frameSamples * config.channels

		const setCluster = (
			sources: ReadonlyArray<MultiplexerSourceInput>,
			options?: { readonly crossfadeDuration?: Duration.DurationInput },
		): Effect.Effect<void, MultiplexerError> =>
			Effect.gen(function* () {
				yield* validateSourceInputs(sources, config)

				const offered = yield* Queue.offer(
					commandQueue,
					internal.Command.SetCluster({
						sources,
						crossfadeDuration: options?.crossfadeDuration,
					}),
				)
				if (!offered) {
					return yield* Effect.fail(
						new MultiplexerCommandQueueError({
							message: "failed to enqueue SetCluster command",
						}),
					)
				}
			})

		const clearCluster = (): Effect.Effect<void, MultiplexerError> =>
			Effect.gen(function* () {
				const offered = yield* Queue.offer(commandQueue, internal.Command.ClearCluster())
				if (!offered) {
					return yield* Effect.fail(
						new MultiplexerCommandQueueError({
							message: "failed to enqueue ClearCluster command",
						}),
					)
				}
			})

		const setMasterVolume = (volume: number): Effect.Effect<void, MultiplexerError> =>
			Effect.gen(function* () {
				if (!Number.isFinite(volume) || volume < 0) {
					return yield* Effect.fail(new MultiplexerInvalidMasterVolumeError({ volume }))
				}
				const offered = yield* Queue.offer(
					commandQueue,
					internal.Command.SetMasterVolume({ volume }),
				)
				if (!offered) {
					return yield* Effect.fail(
						new MultiplexerCommandQueueError({
							message: "failed to enqueue SetMasterVolume command",
						}),
					)
				}
			})

		/**
		 * Renders exactly one output frame.
		 *
		 * Rules:
		 * - processes all pending commands before rendering
		 * - if there is an active transition, crossfades old/new clusters
		 * - if no source is active, returns silence
		 */
		const nextFrame = Effect.gen(function* () {
			const commands = Chunk.toReadonlyArray(yield* Queue.takeAll(commandQueue))
			let state = yield* Ref.get(stateRef)

			for (const command of commands) {
				state = yield* internal.Command.$match(command, {
					SetCluster: ({ crossfadeDuration, sources }) =>
						Effect.gen(function* () {
							const transitionMs = Duration.toMillis(
								crossfadeDuration ?? config.defaultCrossfadeDuration,
							)
							if (!Number.isFinite(transitionMs) || transitionMs < 0) {
								return yield* Effect.fail(
									new MultiplexerInvalidCrossfadeDurationError({
										crossfadeMs: transitionMs,
									}),
								)
							}

							const newCluster = yield* createRuntimeCluster(
								state.nextClusterId,
								pullScope,
								config,
								sources,
							)
							const totalFadeSamples = crossfadeSamples(config.sampleRate, transitionMs)
							const nextState: MultiplexerState = {
								...state,
								nextClusterId: state.nextClusterId + 1,
								activeCluster: newCluster,
								fadingOutCluster: state.activeCluster,
								fadeProgressSamples: 0,
								fadeTotalSamples: totalFadeSamples,
							}
							if (totalFadeSamples === 0) {
								return { ...nextState, fadingOutCluster: null }
							}
							return nextState
						}),
					ClearCluster: () =>
						Effect.succeed({
							...state,
							activeCluster: null,
							fadingOutCluster: null,
							fadeProgressSamples: 0,
							fadeTotalSamples: 0,
						}),
					SetMasterVolume: ({ volume }) =>
						Effect.succeed({
							...state,
							masterVolume: volume,
						}),
				})
			}

			let frame = makeSilenceFrame(frameLength)
			let activeCluster = state.activeCluster
			let fadingOutCluster = state.fadingOutCluster
			let fadeProgressSamples = state.fadeProgressSamples

			if (activeCluster !== null && fadingOutCluster !== null && state.fadeTotalSamples > 0) {
				const oldFrame = yield* renderClusterFrame(fadingOutCluster, frameLength, config.channels)
				const newFrame = yield* renderClusterFrame(activeCluster, frameLength, config.channels)
				const t = Math.min(1, fadeProgressSamples / state.fadeTotalSamples)
				frame = crossfadeFrames(oldFrame.frame, newFrame.frame, t)
				fadeProgressSamples += config.frameSamples
				activeCluster = newFrame.cluster.sources.length > 0 ? newFrame.cluster : null
				fadingOutCluster =
					fadeProgressSamples >= state.fadeTotalSamples
						? null
						: oldFrame.cluster.sources.length > 0
							? oldFrame.cluster
							: null
			} else if (activeCluster !== null) {
				const rendered = yield* renderClusterFrame(activeCluster, frameLength, config.channels)
				frame = rendered.frame
				activeCluster = rendered.cluster.sources.length > 0 ? rendered.cluster : null
				fadingOutCluster = null
				fadeProgressSamples = 0
			}

			yield* Ref.set(stateRef, {
				...state,
				activeCluster,
				fadingOutCluster,
				fadeProgressSamples,
			})

			return applyGain(frame, state.masterVolume)
		})
		const output = Stream.repeatEffect(nextFrame);
		const outputFactory = Stream.broadcastDynamic(output, {
			strategy: "sliding",
			capacity: frameLength
		});
		const asAudioSource = outputFactory.pipe(Effect.map((o) => new AudioSource.AudioSource({
			sampleRate: config.sampleRate,
			channels: config.channels,
			stream: o,
		})))

		return {
			config,
			setCluster,
			clearCluster,
			setMasterVolume,
			output: outputFactory,
			outputUnsafe: output,
			asAudioSource
		}
	}),
}) {}
