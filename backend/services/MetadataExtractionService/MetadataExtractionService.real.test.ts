import { expect } from "bun:test"
import { Effect, Stream } from "effect"
import { existsSync } from "node:fs"

import { it } from "../../bun-test-effect"
import {
	MetadataExtractionService,
	MusicMetadataExtractionService,
} from "./MetadataExtractionService"

const matsuriFileUrl = new URL("../RadioManager/Fujii Kaze - Matsuri.m4a", import.meta.url)
const hasMatsuriFixture = existsSync(matsuriFileUrl)

it.layer(MusicMetadataExtractionService)(({ skipIf }) => {
	skipIf(!hasMatsuriFixture)("extracts real metadata from Matsuri fixture", () =>
		Effect.gen(function* () {
			const extractor = yield* MetadataExtractionService
			const bytes = yield* Effect.promise(() => Bun.file(matsuriFileUrl).arrayBuffer()).pipe(
				Effect.map((buffer) => new Uint8Array(buffer)),
			)

			const metadata = yield* extractor.extractAudioMetadata({
				name: "Fujii Kaze - Matsuri.m4a",
				contentType: "audio/mp4",
				content: Stream.make(bytes),
			})

			expect(metadata.durationMs).toBeGreaterThan(200_000)
			expect(metadata.durationMs).toBeLessThan(300_000)
			expect(metadata.mimeType).toBe("audio/mp4")
			expect(metadata.containerFormat).toBe("M4A/mp42/mp41/isom/iso2")
			expect(metadata.audioCodec).toBe("MPEG-4/AAC")
			expect(metadata.title).toBe("まつり")
			expect(metadata.artist).toBe("藤井 風")
			expect(metadata.album).toBe("LOVE ALL SERVE ALL")
			expect(metadata.coverArt?.mimeType).toBe("image/jpeg")
			expect(metadata.coverArt?.data.byteLength ?? 0).toBeGreaterThan(0)
		}),
	)
})
