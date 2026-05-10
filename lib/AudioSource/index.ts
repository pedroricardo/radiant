import { Data, Effect, Function, Stream } from "effect"
import { AudioSourceConfigurationError } from "../../RadiantClient/lib/AudioSourceErrors"
type IsUnion<T, U = T> = T extends any ? ([U] extends [T] ? false : true) : never
type ValidSampleRate<T extends number> = number extends T
	? never
	: IsUnion<T> extends true
		? never
		: T
export * from "../../RadiantClient/lib/AudioSourceErrors"
const validateConfig = (sampleRate: number, channels: number) =>
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

const frameSamplesPerChannel = (frame: Float32Array, channels: number): number =>
	Math.floor(frame.length / channels)

const mixFrames = (a: Float32Array, b: Float32Array, channels: number): Float32Array => {
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

const resampleInterleavedFrame = (
	frame: Float32Array,
	ratio: number,
	channels: number,
): Float32Array => {
	if (channels <= 0) {
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

export class AudioSource<
	const SampleRate extends number,
	out E = never,
	out R = never,
> extends Data.TaggedClass("AudioSource")<{
	readonly sampleRate: SampleRate
	readonly channels: number
	readonly stream: Stream.Stream<Float32Array, E, R>
}> {}
export const fromPCM = <const SampleRate extends number>(
	pcm: Float32Array[],
	sampleRate: SampleRate,
	channels = 2,
) =>
	Effect.gen(function* () {
		yield* validateConfig(sampleRate, channels)
		return new AudioSource({
			sampleRate,
			channels,
			stream: Stream.fromIterable(pcm),
		})
	})
export const fromLiveStream = <const SampleRate extends number, E, R>(
	stream: Stream.Stream<Float32Array, E, R>,
	sampleRate: SampleRate,
	channels = 2,
) =>
	Effect.gen(function* () {
		yield* validateConfig(sampleRate, channels)
		return new AudioSource({
			sampleRate,
			channels,
			stream,
		})
	})
export const fromAudioFile = Effect.fn("fromAudioFile")(function* (path: string) {
	return yield* Effect.fail(
		new AudioSourceConfigurationError({
			message: `fromAudioFile not implemented for path: ${path}`,
		}),
	)
})
export const combineSources = Function.dual<
	<const SampleRate extends number, E2, R2>(
		that: AudioSource<ValidSampleRate<SampleRate>, E2, R2>,
	) => <E1, R1>(
		self: AudioSource<ValidSampleRate<SampleRate>, E1, R1>,
	) => AudioSource<ValidSampleRate<SampleRate>, E1 | E2 | AudioSourceConfigurationError, R1 | R2>,
	<const SampleRate extends number, E1, R1, E2, R2>(
		self: AudioSource<ValidSampleRate<SampleRate>, E1, R1>,
		that: AudioSource<ValidSampleRate<SampleRate>, E2, R2>,
	) => AudioSource<ValidSampleRate<SampleRate>, E1 | E2 | AudioSourceConfigurationError, R1 | R2>
>(2, (self, that) => {
	if (self.channels !== that.channels) {
		return new AudioSource({
			sampleRate: self.sampleRate,
			channels: self.channels,
			stream: Stream.fail(
				new AudioSourceConfigurationError({
					message: `cannot combine sources with different channels: ${self.channels} vs ${that.channels}`,
				}),
			),
		})
	}

	const stream = Stream.zipAllWith(self.stream, {
		other: that.stream,
		onSelf: (a) => a,
		onOther: (b) => b,
		onBoth: (a, b) => mixFrames(a, b, self.channels),
	})

	return new AudioSource({
		sampleRate: self.sampleRate,
		channels: self.channels,
		stream,
	})
})
export const withVolume = Function.dual<
	(
		volume: number,
	) => <const SampleRate extends number, E, R>(
		self: AudioSource<ValidSampleRate<SampleRate>, E, R>,
	) => AudioSource<ValidSampleRate<SampleRate>, E, R>,
	<const SampleRate extends number, E, R>(
		self: AudioSource<ValidSampleRate<SampleRate>, E, R>,
		volume: number,
	) => AudioSource<ValidSampleRate<SampleRate>, E, R>
>(2, (self, volume) => {
	const stream = self.stream.pipe(
		Stream.map((frame) => {
			const out = new Float32Array(frame.length)

			for (let i = 0; i < frame.length; i++) {
				out[i] = frame[i]! * volume
			}

			return out
		}),
	)

	return new AudioSource({
		sampleRate: self.sampleRate,
		channels: self.channels,
		stream,
	})
})
export const resampleTo = Function.dual<
	<const TargetRate extends number>(
		targetRate: TargetRate,
	) => <const SourceRate extends number, E, R>(
		self: AudioSource<SourceRate, E, R>,
	) => AudioSource<TargetRate, E | AudioSourceConfigurationError, R>,
	<const TargetRate extends number, const SourceRate extends number, E, R>(
		self: AudioSource<SourceRate, E, R>,
		targetRate: TargetRate,
	) => AudioSource<TargetRate, E | AudioSourceConfigurationError, R>
>(2, (self, targetRate) => {
	if (!Number.isFinite(targetRate) || targetRate <= 0) {
		return new AudioSource({
			sampleRate: targetRate,
			channels: self.channels,
			stream: Stream.fail(
				new AudioSourceConfigurationError({
					message: `invalid targetRate: ${targetRate}`,
				}),
			),
		})
	}

	if ((self.sampleRate as number) === (targetRate as number)) {
		return new AudioSource({
			sampleRate: targetRate,
			channels: self.channels,
			stream: self.stream,
		})
	}

	const ratio = self.sampleRate / targetRate

	const stream = self.stream.pipe(
		Stream.map((frame) => resampleInterleavedFrame(frame, ratio, self.channels)),
	)

	return new AudioSource({
		sampleRate: targetRate,
		channels: self.channels,
		stream,
	})
})
