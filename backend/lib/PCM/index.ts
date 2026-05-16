export const concatUint8Arrays = (
	left: Uint8Array<ArrayBufferLike>,
	right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBufferLike> => {
	if (left.length === 0) {
		return right
	}
	if (right.length === 0) {
		return left
	}

	const out = new Uint8Array(left.length + right.length)
	out.set(left, 0)
	out.set(right, left.length)
	return out
}
import { AudioSourceConfigurationError } from "@radiant/client/lib/AudioSourceErrors"
import { Effect, Function } from "effect"

export type PCMFrame = Float32Array

export type PCMConfig = {
	readonly sampleRate: number
	readonly channels: number
}

/**
 * Validates a raw PCM stream configuration.
 *
 * `sampleRate` must be a positive finite number and `channels` must be a
 * positive integer. This is the shared low-level guard used by `AudioSource`
 * constructors and by other PCM helpers that assume interleaved linear PCM.
 */
export const validateConfig = (sampleRate: number, channels: number) =>
	Effect.gen(function* () {
		if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
			return yield* Effect.fail(
				new AudioSourceConfigurationError({
					message: `invalid sampleRate: ${sampleRate}`,
				}),
			)
		}

		if (!Number.isInteger(channels) || channels <= 0) {
			return yield* Effect.fail(
				new AudioSourceConfigurationError({
					message: `invalid channels: ${channels}`,
				}),
			)
		}
	})

/**
 * Returns the number of samples per channel in an interleaved PCM frame.
 *
 * Example for stereo:
 * - frame length `2048`
 * - channels `2`
 * - result `1024`
 */
export const frameSamplesPerChannel = (frame: PCMFrame, channels: number): number => {
	if (!Number.isInteger(channels) || channels <= 0) {
		return 0
	}

	return Math.floor(frame.length / channels)
}

/**
 * Computes the total interleaved frame length for a given logical frame size.
 *
 * Example:
 * - `frameSamples = 1024`
 * - `channels = 2`
 * - result `2048`
 */
export const frameLength = (frameSamples: number, channels: number): number => {
	if (!Number.isInteger(frameSamples) || frameSamples <= 0) {
		return 0
	}

	if (!Number.isInteger(channels) || channels <= 0) {
		return 0
	}

	return frameSamples * channels
}

/**
 * Returns the number of bytes required to store one interleaved `Float32`
 * frame with the provided dimensions.
 */
export const frameByteLength = (frameSamples: number, channels: number): number =>
	frameLength(frameSamples, channels) * Float32Array.BYTES_PER_ELEMENT

/**
 * Allocates a silent PCM frame of the requested logical size.
 *
 * The resulting frame is interleaved and zero-filled.
 */
export const emptyFrame = (frameSamples: number, channels: number): PCMFrame =>
	new Float32Array(frameLength(frameSamples, channels))

/**
 * Returns a deep copy of a PCM frame.
 *
 * Useful when a caller needs to preserve frame identity boundaries and avoid
 * mutating shared sample buffers.
 */
export const copyFrame = (frame: PCMFrame): PCMFrame => {
	const out = new Float32Array(frame.length)
	out.set(frame, 0)
	return out
}

/**
 * Concatenates two interleaved PCM frames into one contiguous frame.
 *
 * This is mainly used by streaming decoders / renderers that accumulate partial
 * pulls until a complete output frame is available.
 */
export const concatFrames = (left: PCMFrame, right: PCMFrame): PCMFrame => {
	if (left.length === 0) {
		return right
	}

	if (right.length === 0) {
		return left
	}

	const out = new Float32Array(left.length + right.length)
	out.set(left, 0)
	out.set(right, left.length)
	return out
}

/**
 * Checks whether all samples in the frame are exactly zero.
 */
export const isSilent = (frame: PCMFrame): boolean => {
	for (let i = 0; i < frame.length; i++) {
		if (frame[i] !== 0) {
			return false
		}
	}

	return true
}

/**
 * Applies a linear gain to every sample and returns a new frame.
 *
 * No clipping protection is applied here. Use `clampFrame` or
 * `normalizeFrame` afterwards when needed.
 */
export const applyVolume = (frame: PCMFrame, volume: number): PCMFrame => {
	const out = new Float32Array(frame.length)

	for (let i = 0; i < frame.length; i++) {
		out[i] = frame[i]! * volume
	}

	return out
}

/**
 * Data-first / data-last helper for `applyVolume`.
 */
export const withVolume = Function.dual<
	(volume: number) => (self: PCMFrame) => PCMFrame,
	(self: PCMFrame, volume: number) => PCMFrame
>(2, (self, volume) => applyVolume(self, volume))

/**
 * Mixes multiple frames by averaging sample values.
 *
 * This is safer than direct summation because it reduces clipping risk when
 * several sources are active at the same time.
 */
export const averageFrames = (
	frames: ReadonlyArray<PCMFrame>,
	frameLength: number,
): PCMFrame => {
	if (frames.length === 0) {
		return new Float32Array(frameLength)
	}

	const out = new Float32Array(frameLength)

	for (const frame of frames) {
		for (let i = 0; i < frameLength; i++) {
			out[i] = out[i]! + (frame[i] ?? 0)
		}
	}

	const gain = 1 / frames.length

	for (let i = 0; i < frameLength; i++) {
		out[i] = out[i]! * gain
	}

	return out
}

/**
 * Performs a linear crossfade between two frames.
 *
 * - `t = 0` => only `from`
 * - `t = 1` => only `to`
 */
export const crossfadeFrames = (
	from: PCMFrame,
	to: PCMFrame,
	t: number,
): PCMFrame => {
	const length = Math.min(from.length, to.length)
	const out = new Float32Array(length)
	const fromGain = 1 - t
	const toGain = t

	for (let i = 0; i < length; i++) {
		out[i] = (from[i] ?? 0) * fromGain + (to[i] ?? 0) * toGain
	}

	return out
}

/**
 * Mixes two frames sample-by-sample using averaging when both frames provide
 * data at the same position.
 *
 * If one frame is shorter, the remaining tail of the longer frame is copied
 * through unchanged.
 */
export const mixFrames = (a: PCMFrame, b: PCMFrame, channels: number): PCMFrame => {
	if (channels <= 0) {
		return new Float32Array(0)
	}

	const aSamples = frameSamplesPerChannel(a, channels)
	const bSamples = frameSamplesPerChannel(b, channels)
	const outSamples = Math.max(aSamples, bSamples)
	const out = new Float32Array(outSamples * channels)

	for (let sample = 0; sample < outSamples; sample++) {
		for (let channel = 0; channel < channels; channel++) {
			const index = sample * channels + channel

			const aDefined = sample < aSamples
			const bDefined = sample < bSamples

			const aValue = aDefined ? a[index]! : 0
			const bValue = bDefined ? b[index]! : 0

			if (aDefined && bDefined) {
				out[index] = (aValue + bValue) * 0.5
			} else if (aDefined) {
				out[index] = aValue
			} else if (bDefined) {
				out[index] = bValue
			}
		}
	}

	return out
}

/**
 * Adds two frames sample-by-sample without normalization.
 *
 * This is the raw summation primitive. It may produce values outside `[-1, 1]`.
 */
export const addFrames = (a: PCMFrame, b: PCMFrame, channels: number): PCMFrame => {
	if (channels <= 0) {
		return new Float32Array(0)
	}

	const aSamples = frameSamplesPerChannel(a, channels)
	const bSamples = frameSamplesPerChannel(b, channels)
	const outSamples = Math.max(aSamples, bSamples)
	const out = new Float32Array(outSamples * channels)

	for (let i = 0; i < out.length; i++) {
		out[i] = (a[i] ?? 0) + (b[i] ?? 0)
	}

	return out
}

/**
 * Clamps every sample in the frame to a target range.
 */
export const clampFrame = (frame: PCMFrame, min = -1, max = 1): PCMFrame => {
	const out = new Float32Array(frame.length)

	for (let i = 0; i < frame.length; i++) {
		const sample = frame[i]!
		out[i] = sample < min ? min : sample > max ? max : sample
	}

	return out
}

/**
 * Normalizes the frame so that its peak absolute amplitude becomes `1`.
 *
 * Silent frames and already-normalized frames are copied unchanged.
 */
export const normalizeFrame = (frame: PCMFrame): PCMFrame => {
	let peak = 0

	for (let i = 0; i < frame.length; i++) {
		const abs = Math.abs(frame[i]!)
		if (abs > peak) {
			peak = abs
		}
	}

	if (peak === 0 || peak <= 1) {
		return copyFrame(frame)
	}

	const out = new Float32Array(frame.length)

	for (let i = 0; i < frame.length; i++) {
		out[i] = frame[i]! / peak
	}

	return out
}

/**
 * Resamples an interleaved frame using simple linear interpolation.
 *
 * `ratio` is interpreted as `sourceSampleRate / targetSampleRate`.
 */
export const resampleInterleavedFrame = (
	frame: PCMFrame,
	ratio: number,
	channels: number,
): PCMFrame => {
	if (channels <= 0) {
		return new Float32Array(0)
	}

	if (!Number.isFinite(ratio) || ratio <= 0) {
		return new Float32Array(0)
	}

	const sourceSamplesPerChannel = frameSamplesPerChannel(frame, channels)

	if (sourceSamplesPerChannel === 0) {
		return new Float32Array(0)
	}

	const targetSamplesPerChannel = Math.floor(sourceSamplesPerChannel / ratio)
	const out = new Float32Array(targetSamplesPerChannel * channels)

	for (let channel = 0; channel < channels; channel++) {
		for (let sample = 0; sample < targetSamplesPerChannel; sample++) {
			const position = sample * ratio
			const i0 = Math.floor(position)
			const i1 = Math.min(i0 + 1, sourceSamplesPerChannel - 1)
			const t = position - i0

			const s0 = frame[i0 * channels + channel]!
			const s1 = frame[i1 * channels + channel]!

			out[sample * channels + channel] = s0 * (1 - t) + s1 * t
		}
	}

	return out
}

/**
 * Interprets a byte slice as an interleaved `Float32Array` frame and copies the
 * samples into a new owned frame.
 */
export const fromInterleavedFloat32Bytes = (
	bytes: Uint8Array<ArrayBufferLike>,
	frameLength: number,
): PCMFrame => {
	const pcmView = new Float32Array(bytes.buffer, bytes.byteOffset, frameLength)

	const frame = new Float32Array(frameLength)
	frame.set(pcmView, 0)

	return frame
}

/**
 * Decodes a possibly partial `Float32` byte slice into a fixed-size frame.
 *
 * Any missing tail samples are left as silence.
 */
export const fromPartialInterleavedFloat32Bytes = (
	bytes: Uint8Array<ArrayBufferLike>,
	frameLength: number,
): PCMFrame => {
	const alignedByteLength = bytes.length - (bytes.length % Float32Array.BYTES_PER_ELEMENT)

	const frame = new Float32Array(frameLength)

	if (alignedByteLength === 0) {
		return frame
	}

	const sampleCount = alignedByteLength / Float32Array.BYTES_PER_ELEMENT

	frame.set(new Float32Array(bytes.buffer, bytes.byteOffset, sampleCount), 0)

	return frame
}

/**
 * Returns the largest prefix of the byte buffer that is aligned to a whole
 * number of `Float32` samples.
 */
export const alignedFloat32ByteLength = (bytes: Uint8Array<ArrayBufferLike>): number =>
	bytes.length - (bytes.length % Float32Array.BYTES_PER_ELEMENT)
