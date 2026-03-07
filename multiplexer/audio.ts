/**
 * Este módulo contém só matemática/transformações de áudio PCM interleaved.
 *
 * Convenções usadas:
 * - Frame = Float32Array com `frameLength = frameSamples * channels`
 * - Samples em [-1, 1]
 * - Estéreo interleaved: L0, R0, L1, R1...
 */

/**
 * Produz um frame de silêncio (todos os samples em 0).
 */
export const makeSilenceFrame = (frameLength: number): Float32Array => new Float32Array(frameLength)

/**
 * Junta dois buffers de áudio num único array contínuo.
 * Usado para acumular dados puxados da source até completar um frame de saída.
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
 * Faz a mistura de N frames por média simples.
 * Evita clipping grosseiro em relação a soma direta.
 */
export const averageFrames = (frames: ReadonlyArray<Float32Array>, frameLength: number): Float32Array => {
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
 * Aplica ganho linear no frame inteiro.
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
 * Crossfade linear entre dois frames:
 * t=0 => só frame "from", t=1 => só frame "to".
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
