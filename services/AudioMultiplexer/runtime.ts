import { Chunk, Effect, Option, Scope, Stream } from "effect"
import * as AudioSource from "../../lib/AudioSource"
import type { MultiplexerError } from "./Error"
import {
	MultiplexerInvalidConfigError,
	MultiplexerInvalidSourceVolumeError,
	MultiplexerSourceChannelMismatchError,
	MultiplexerSourceFrameShapeError,
	MultiplexerSourceInvalidSampleRateError,
	MultiplexerSourcePullError,
} from "./Error"
import { applyGain, averageFrames, concatFloat32 } from "./internal/audio"
import type {
	AudioMultiplexerConfig,
	MultiplexerSourceInput,
	RuntimeCluster,
	RuntimeSource,
} from "./types"

/**
 * Validates static engine configuration.
 */
export const validateConfig = (
	config: AudioMultiplexerConfig,
): Effect.Effect<void, MultiplexerInvalidConfigError> =>
	Effect.gen(function* () {
		if (!Number.isFinite(config.sampleRate) || config.sampleRate <= 0) {
			return yield* Effect.fail(
				new MultiplexerInvalidConfigError({ message: `invalid sampleRate: ${config.sampleRate}` }),
			)
		}
		if (config.channels !== 1 && config.channels !== 2) {
			return yield* Effect.fail(
				new MultiplexerInvalidConfigError({ message: `unsupported channels: ${config.channels}` }),
			)
		}
		if (!Number.isInteger(config.frameSamples) || config.frameSamples <= 0) {
			return yield* Effect.fail(
				new MultiplexerInvalidConfigError({
					message: `invalid frameSamples: ${config.frameSamples}`,
				}),
			)
		}
		if (!Number.isFinite(config.defaultCrossfadeMs) || config.defaultCrossfadeMs < 0) {
			return yield* Effect.fail(
				new MultiplexerInvalidConfigError({
					message: `invalid defaultCrossfadeMs: ${config.defaultCrossfadeMs}`,
				}),
			)
		}
	})

/**
 * Converts crossfade duration (ms) into number of samples per channel.
 */
export const crossfadeSamples = (sampleRate: number, crossfadeMs: number): number =>
	Math.max(0, Math.round((crossfadeMs / 1_000) * sampleRate))

/**
 * Early validation for `setCluster`.
 * Prevents enqueuing invalid commands.
 */
export const validateSourceInputs = (
	sources: ReadonlyArray<MultiplexerSourceInput>,
	config: AudioMultiplexerConfig,
): Effect.Effect<void, MultiplexerError> =>
	Effect.gen(function* () {
		for (const sourceInput of sources) {
			const { id, source } = sourceInput
			const volume = sourceInput.volume ?? 1
			if (!Number.isFinite(volume) || volume < 0) {
				return yield* Effect.fail(new MultiplexerInvalidSourceVolumeError({ sourceId: id, volume }))
			}
			if (!Number.isFinite(source.sampleRate) || source.sampleRate <= 0) {
				return yield* Effect.fail(
					new MultiplexerSourceInvalidSampleRateError({
						sourceId: id,
						sampleRate: source.sampleRate,
					}),
				)
			}
			if (source.channels !== config.channels) {
				return yield* Effect.fail(
					new MultiplexerSourceChannelMismatchError({
						sourceId: id,
						expectedChannels: config.channels,
						actualChannels: source.channels,
					}),
				)
			}
		}
	})

/**
 * Instantiates a runtime cluster:
 * - normalizes sampleRate
 * - creates a stream `pull` for incremental consumption
 * - initializes an empty per-source buffer
 */
export const createRuntimeCluster = (
	clusterId: number,
	pullScope: Scope.Scope,
	config: AudioMultiplexerConfig,
	sources: ReadonlyArray<MultiplexerSourceInput>,
): Effect.Effect<RuntimeCluster, MultiplexerError> =>
	Effect.gen(function* () {
		const runtimeSources: RuntimeSource[] = []

		for (const sourceInput of sources) {
			const { id, source } = sourceInput
			const volume = sourceInput.volume ?? 1
			const normalized =
				source.sampleRate === config.sampleRate
					? source
					: AudioSource.resampleTo(source, config.sampleRate)
			const pull = yield* Stream.toPull(normalized.stream).pipe(Scope.extend(pullScope))

			runtimeSources.push({
				id,
				volume,
				pull,
				buffer: new Float32Array(0),
				ended: false,
			})
		}

		return {
			id: clusterId,
			sources: runtimeSources,
		}
	})

/**
 * Renders one frame from a source.
 *
 * Flow:
 * 1) pull chunks until we have enough data for `frameLength`
 * 2) build the output frame and keep leftovers in the buffer
 * 3) if EOF + empty buffer => source can be removed
 */
export const renderSourceFrame = (
	source: RuntimeSource,
	frameLength: number,
	channels: number,
): Effect.Effect<
	{
		readonly frame: Float32Array
		readonly nextSource: RuntimeSource
		readonly remove: boolean
	},
	MultiplexerSourceFrameShapeError | MultiplexerSourcePullError
> =>
	Effect.gen(function* () {
		let buffer = source.buffer
		let ended = source.ended

		while (buffer.length < frameLength && !ended) {
			const pulled = yield* Effect.either(source.pull)
			if (pulled._tag === "Left") {
				if (Option.isNone(pulled.left)) {
					ended = true
				} else {
					return yield* Effect.fail(
						new MultiplexerSourcePullError({
							sourceId: source.id,
							cause: pulled.left.value,
						}),
					)
				}
			} else {
				for (const chunkFrame of Chunk.toReadonlyArray(pulled.right)) {
					if (chunkFrame.length % channels !== 0) {
						return yield* Effect.fail(
							new MultiplexerSourceFrameShapeError({
								sourceId: source.id,
								frameLength: chunkFrame.length,
								channels,
							}),
						)
					}
					buffer = concatFloat32(buffer, chunkFrame)
				}
			}
		}

		const frame = new Float32Array(frameLength)
		const consumed = Math.min(frameLength, buffer.length)
		frame.set(buffer.subarray(0, consumed), 0)

		const remaining = buffer.length - consumed
		const nextBuffer = new Float32Array(remaining)
		nextBuffer.set(buffer.subarray(consumed), 0)

		return {
			frame: applyGain(frame, source.volume),
			nextSource: {
				...source,
				buffer: nextBuffer,
				ended,
			},
			remove: ended && remaining === 0,
		}
	})

/**
 * Renders one frame from a cluster:
 * - renders each source
 * - removes ended sources
 * - mixes the result using averaging
 */
export const renderClusterFrame = (
	cluster: RuntimeCluster,
	frameLength: number,
	channels: number,
): Effect.Effect<
	{
		readonly frame: Float32Array
		readonly cluster: RuntimeCluster
	},
	MultiplexerSourceFrameShapeError | MultiplexerSourcePullError
> =>
	Effect.gen(function* () {
		const nextSources: RuntimeSource[] = []
		const renderedFrames: Float32Array[] = []

		for (const source of cluster.sources) {
			const rendered = yield* renderSourceFrame(source, frameLength, channels)
			renderedFrames.push(rendered.frame)
			if (!rendered.remove) {
				nextSources.push(rendered.nextSource)
			}
		}

		return {
			frame: averageFrames(renderedFrames, frameLength),
			cluster: {
				id: cluster.id,
				sources: nextSources,
			},
		}
	})
