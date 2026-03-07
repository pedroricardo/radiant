import { describe, expect } from "bun:test"
import { Chunk, Effect, Exit, Stream } from "effect"
import { it } from "../bun-test-effect"
import { AudioSource } from "../audio-source"
import { IcyEncoder } from "./index"

const toBytes = (chunks: Chunk.Chunk<Uint8Array>): Uint8Array => {
	const arrays = Chunk.toReadonlyArray(chunks)
	let total = 0
	for (const array of arrays) {
		total += array.length
	}

	const out = new Uint8Array(total)
	let offset = 0
	for (const array of arrays) {
		out.set(array, offset)
		offset += array.length
	}
	return out
}

const makeIcyMetadata = (title: string): Uint8Array => {
	const metadata = new TextEncoder().encode(`StreamTitle='${title}';`)
	const blocks = Math.ceil(metadata.length / 16)
	const body = new Uint8Array(blocks * 16)
	body.set(metadata)
	const out = new Uint8Array(1 + body.length)
	out[0] = blocks
	out.set(body, 1)
	return out
}

const findPatternPositions = (haystack: Uint8Array, needle: Uint8Array): number[] => {
	const positions: number[] = []
	if (needle.length === 0 || haystack.length < needle.length) {
		return positions
	}
	for (let i = 0; i <= haystack.length - needle.length; i++) {
		let ok = true
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) {
				ok = false
				break
			}
		}
		if (ok) {
			positions.push(i)
		}
	}
	return positions
}

describe("IcyEncoder", () => {
	const withEncoder = it.layer(IcyEncoder.Default)((testers) => testers)

	withEncoder.effect("inserts ICY metadata on exact meta interval boundaries", () =>
		Effect.gen(function* () {
			const encoder = yield* IcyEncoder
			const title = "__META_BOUNDARY_TEST__"
			const metaInterval = 512
			const frame = new Float32Array(1152 * 2 * 40)
			for (let i = 0; i < frame.length; i++) {
				frame[i] = Math.sin(i / 32)
			}
			const source = yield* AudioSource.fromPCM([frame], 44_100, 2)

			const stream = yield* encoder.encode(source, {
				kbps: 128,
				metaInterval,
				metadataTitle: title,
			})

			const chunks = yield* Stream.runCollect(stream)
			const bytes = toBytes(chunks)
			const metadata = makeIcyMetadata(title)
			const positions = findPatternPositions(bytes, metadata)

			expect(positions.length).toBeGreaterThan(0)
			for (let i = 0; i < positions.length; i++) {
				expect(positions[i]).toBe(metaInterval + i * (metaInterval + metadata.length))
			}
		}),
	)

	withEncoder.effect("supports mono frames when channels = 1", () =>
		Effect.gen(function* () {
			const encoder = yield* IcyEncoder
			const frame = new Float32Array(1152 * 20)
			for (let i = 0; i < frame.length; i++) {
				frame[i] = Math.sin(i / 16)
			}
			const source = yield* AudioSource.fromPCM([frame], 44_100, 1)

			const stream = yield* encoder.encode(source, {
				kbps: 128,
				metaInterval: 1024,
				metadataTitle: "Mono",
			})

			const chunks = yield* Stream.runCollect(stream)
			const bytes = toBytes(chunks)
			expect(bytes.length).toBeGreaterThan(0)
		}),
	)

	withEncoder.effect("fails when pcm frame length does not match channel count", () =>
			Effect.gen(function* () {
				const encoder = yield* IcyEncoder
				const invalidFrame = new Float32Array([0.1, 0.2, 0.3])
				const invalidSource = new AudioSource.AudioSource({
					sampleRate: 44_100,
					channels: 2,
					stream: Stream.fromIterable([invalidFrame]),
				})
				const stream = yield* encoder.encode(invalidSource, {
					kbps: 128,
				})

			const exit = yield* Effect.exit(Stream.runCollect(stream))
			expect(Exit.isFailure(exit)).toBe(true)
		}),
	)
})
