/**
 * This module contains only interleaved PCM audio math / transforms.
 *
 * Conventions:
 * - Frame = Float32Array with `frameLength = frameSamples * channels`
 * - Samples are in [-1, 1]
 * - Interleaved stereo layout: L0, R0, L1, R1...
 */

/**
 * Produces a silent frame (all samples = 0).
 */
export const makeSilenceFrame = (frameLength: number): Float32Array => new Float32Array(frameLength)

/**
 * Concatenates two audio buffers into one contiguous array.
 * Used to accumulate pulled source data until one output frame is full.
 */
export const concatFloat32 = (a: Float32Array, b: Float32Array): Float32Array => {
	if (a.length === 0) {
		return b
	}
	if (b.length === 0) {
		return a
	}
	const out = new Float32Array(a.length + b.length)
	out.set(a, 0)
	out.set(b, a.length)
	return out
}

/**
 * Mixes N frames using simple averaging.
 * This is safer than direct summation because it reduces clipping risk.
 */
export const averageFrames = (
	frames: ReadonlyArray<Float32Array>,
	frameLength: number,
): Float32Array => {
	if (frames.length === 0) {
		return makeSilenceFrame(frameLength)
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
 * Applies a linear gain to the whole frame.
 */
export const applyGain = (frame: Float32Array, gain: number): Float32Array => {
	if (gain === 1) {
		return frame
	}
	const out = new Float32Array(frame.length)
	for (let i = 0; i < frame.length; i++) {
		out[i] = frame[i]! * gain
	}
	return out
}

/**
 * Linear crossfade between two frames:
 * t=0 => only "from", t=1 => only "to".
 */
export const crossfadeFrames = (from: Float32Array, to: Float32Array, t: number): Float32Array => {
	const length = Math.min(from.length, to.length)
	const out = new Float32Array(length)
	const fromGain = 1 - t
	const toGain = t
	for (let i = 0; i < length; i++) {
		out[i] = (from[i] ?? 0) * fromGain + (to[i] ?? 0) * toGain
	}
	return out
}
