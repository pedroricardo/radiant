CREATE TABLE "media_node_audio_metadata" (
	"mediaNodeId" varchar PRIMARY KEY NOT NULL,
	"storageKey" varchar NOT NULL,
	"mimeType" varchar,
	"sizeBytes" bigint,
	"durationMs" integer NOT NULL,
	"containerFormat" varchar,
	"audioCodec" varchar,
	"bitrate" integer,
	"title" varchar,
	"artist" varchar,
	"album" varchar,
	"albumArtist" varchar,
	"genre" text,
	"year" integer,
	"trackNumber" integer,
	"trackTotal" integer,
	"diskNumber" integer,
	"diskTotal" integer,
	"coverArtStorageKey" varchar,
	"coverArtMimeType" varchar,
	"sampleRate" integer,
	"channels" integer,
	"fileHash" varchar NOT NULL,
	CONSTRAINT "media_node_audio_metadata_mediaNodeId_media_nodes_id_fk"
		FOREIGN KEY ("mediaNodeId")
		REFERENCES "public"."media_nodes"("id")
		ON DELETE CASCADE
);
