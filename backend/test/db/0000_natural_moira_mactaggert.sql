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
	"fileHash" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_nodes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"parentId" varchar,
	"kind" text NOT NULL,
	"name" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"userId" varchar NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_account_unique" PRIMARY KEY("provider","userId")
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"provider" text NOT NULL,
	"state" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	CONSTRAINT "oauth_state_pk" PRIMARY KEY("provider","state")
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"playlistId" varchar NOT NULL,
	"mediaNodeId" varchar NOT NULL,
	"kind" text DEFAULT 'track' NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"playbackMode" text DEFAULT 'linear' NOT NULL,
	"preventImmediateRepeats" boolean DEFAULT false NOT NULL,
	"crossfadeOverrideMs" integer,
	"jingleMinGapTracks" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playout_interruptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"mediaNodeId" varchar NOT NULL,
	"startsAt" timestamp NOT NULL,
	"endsAt" timestamp,
	"modeAfterPlayback" text DEFAULT 'overlay' NOT NULL,
	"createdByUserId" varchar NOT NULL,
	"note" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radios" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"timezone" varchar NOT NULL,
	"defaultCrossfadeMs" integer DEFAULT 0 NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"createdByUserId" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_one_off_blocks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"startsAt" timestamp NOT NULL,
	"endsAt" timestamp NOT NULL,
	"targetType" text NOT NULL,
	"playlistId" varchar,
	"mediaNodeId" varchar,
	"playlistFillMode" text,
	"playbackMode" text DEFAULT 'continue' NOT NULL,
	"modeAfterPlayback" text DEFAULT 'overlay' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_weekly_blocks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"weekday" integer NOT NULL,
	"startMinuteOfDay" integer NOT NULL,
	"endMinuteOfDay" integer NOT NULL,
	"targetType" text NOT NULL,
	"playlistId" varchar,
	"mediaNodeId" varchar,
	"playlistFillMode" text,
	"playbackMode" text DEFAULT 'continue' NOT NULL,
	"modeAfterPlayback" text DEFAULT 'overlay' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"userId" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"email" varchar NOT NULL,
	"avatarUrl" varchar NOT NULL,
	"storageQuotaBytes" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_node_audio_metadata" ADD CONSTRAINT "media_node_audio_metadata_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_nodes" ADD CONSTRAINT "media_nodes_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_nodes" ADD CONSTRAINT "media_nodes_parentId_media_nodes_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."media_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlistId_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_interruptions" ADD CONSTRAINT "playout_interruptions_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_interruptions" ADD CONSTRAINT "playout_interruptions_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_interruptions" ADD CONSTRAINT "playout_interruptions_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radios" ADD CONSTRAINT "radios_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ADD CONSTRAINT "schedule_one_off_blocks_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ADD CONSTRAINT "schedule_one_off_blocks_playlistId_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ADD CONSTRAINT "schedule_one_off_blocks_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_blocks" ADD CONSTRAINT "schedule_weekly_blocks_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_blocks" ADD CONSTRAINT "schedule_weekly_blocks_playlistId_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_blocks" ADD CONSTRAINT "schedule_weekly_blocks_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_nodes_radio_parent_name_index" ON "media_nodes" USING btree ("radioId","parentId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_account_id_unique_index" ON "oauth_accounts" USING btree ("provider","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_items_playlist_position_index" ON "playlist_items" USING btree ("playlistId","position");--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_radio_name_index" ON "playlists" USING btree ("radioId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "usersEmailIndex" ON "users" USING btree ("email");