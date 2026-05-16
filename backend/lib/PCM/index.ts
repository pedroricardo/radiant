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

export const frameSamplesPerChannel = (frame: PCMFrame, channels: number): number => {
	if (!Number.isInteger(channels) || channels <= 0) {
		return 0
	}

	return Math.floor(frame.length / channels)
}

export const frameLength = (frameSamples: number, channels: number): number => {
	if (!Number.isInteger(frameSamples) || frameSamples <= 0) {
		return 0
	}

	if (!Number.isInteger(channels) || channels <= 0) {
		return 0
	}

	return frameSamples * channels
}

export const frameByteLength = (frameSamples: number, channels: number): number =>
	frameLength(frameSamples, channels) * Float32Array.BYTES_PER_ELEMENT

export const emptyFrame = (frameSamples: number, channels: number): PCMFrame =>
	new Float32Array(frameLength(frameSamples, channels))

export const copyFrame = (frame: PCMFrame): PCMFrame => {
	const out = new Float32Array(frame.length)
	out.set(frame, 0)
	return out
}

export const isSilent = (frame: PCMFrame): boolean => {
	for (let i = 0; i < frame.length; i++) {
		if (frame[i] !== 0) {
			return false
		}
	}

	return true
}

export const applyVolume = (frame: PCMFrame, volume: number): PCMFrame => {
	const out = new Float32Array(frame.length)

	for (let i = 0; i < frame.length; i++) {
		out[i] = frame[i]! * volume
	}

	return out
}

export const withVolume = Function.dual<
	(volume: number) => (self: PCMFrame) => PCMFrame,
	(self: PCMFrame, volume: number) => PCMFrame
>(2, (self, volume) => applyVolume(self, volume))

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

export const clampFrame = (frame: PCMFrame, min = -1, max = 1): PCMFrame => {
	const out = new Float32Array(frame.length)

	for (let i = 0; i < frame.length; i++) {
		const sample = frame[i]!
		out[i] = sample < min ? min : sample > max ? max : sample
	}

	return out
}

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

export const fromInterleavedFloat32Bytes = (
	bytes: Uint8Array<ArrayBufferLike>,
	frameLength: number,
): PCMFrame => {
	const pcmView = new Float32Array(bytes.buffer, bytes.byteOffset, frameLength)

	const frame = new Float32Array(frameLength)
	frame.set(pcmView, 0)

	return frame
}

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

export const alignedFloat32ByteLength = (bytes: Uint8Array<ArrayBufferLike>): number =>
	bytes.length - (bytes.length % Float32Array.BYTES_PER_ELEMENT)
