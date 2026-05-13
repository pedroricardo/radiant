import { bigint, integer, pgTable, text, varchar } from "drizzle-orm/pg-core"

import { mediaNodeIdType, mediaNodes } from "./mediaNodes"

export const mediaNodeAudioMetadata = pgTable("media_node_audio_metadata", {
	mediaNodeId: mediaNodeIdType()
		.primaryKey()
		.references(() => mediaNodes.id, { onDelete: "cascade" }),
	storageKey: varchar().notNull(),
	mimeType: varchar(),
	sizeBytes: bigint({ mode: "bigint" }),
	durationMs: integer().notNull(),
	containerFormat: varchar(),
	audioCodec: varchar(),
	bitrate: integer(),
	title: varchar(),
	artist: varchar(),
	album: varchar(),
	albumArtist: varchar(),
	genre: text(),
	year: integer(),
	trackNumber: integer(),
	trackTotal: integer(),
	diskNumber: integer(),
	diskTotal: integer(),
	coverArtStorageKey: varchar(),
	coverArtMimeType: varchar(),
	sampleRate: integer(),
	channels: integer(),
	fileHash: varchar().notNull(),
})
