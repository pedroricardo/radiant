CREATE TABLE "radios" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" varchar,
	"timezone" varchar NOT NULL,
	"defaultCrossfadeMs" integer DEFAULT 0 NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"createdByUserId" varchar NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radio_members" (
	"radioId" varchar NOT NULL,
	"userId" varchar NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radio_members_pk" PRIMARY KEY("radioId","userId")
);
--> statement-breakpoint
CREATE TABLE "media_nodes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"parentId" varchar,
	"kind" text NOT NULL,
	"name" varchar NOT NULL,
	"storageKey" varchar,
	"mimeType" varchar,
	"sizeBytes" bigint,
	"durationMs" integer,
	"sampleRate" integer,
	"channels" integer,
	"fileHash" varchar,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
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
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"playlistId" varchar NOT NULL,
	"mediaNodeId" varchar NOT NULL,
	"kind" text DEFAULT 'track' NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_weekly_blocks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"weekday" integer NOT NULL,
	"startMinuteOfDay" integer NOT NULL,
	"endMinuteOfDay" integer NOT NULL,
	"targetType" text NOT NULL,
	"playlistId" varchar NOT NULL,
	"mediaNodeId" varchar NOT NULL,
	"playbackMode" text DEFAULT 'continue' NOT NULL,
	"modeAfterPlayback" text DEFAULT 'keep_clock' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_one_off_blocks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"startsAt" timestamp with time zone NOT NULL,
	"endsAt" timestamp with time zone NOT NULL,
	"targetType" text NOT NULL,
	"playlistId" varchar NOT NULL,
	"mediaNodeId" varchar NOT NULL,
	"playbackMode" text DEFAULT 'continue' NOT NULL,
	"modeAfterPlayback" text DEFAULT 'keep_clock' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playout_interruptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"radioId" varchar NOT NULL,
	"mediaNodeId" varchar NOT NULL,
	"startsAt" timestamp with time zone NOT NULL,
	"endsAt" timestamp with time zone,
	"modeAfterPlayback" text DEFAULT 'keep_clock' NOT NULL,
	"createdByUserId" varchar NOT NULL,
	"note" varchar,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "radios" ADD CONSTRAINT "radios_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_members" ADD CONSTRAINT "radio_members_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radio_members" ADD CONSTRAINT "radio_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_nodes" ADD CONSTRAINT "media_nodes_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_nodes" ADD CONSTRAINT "media_nodes_parentId_media_nodes_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."media_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlistId_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_blocks" ADD CONSTRAINT "schedule_weekly_blocks_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_blocks" ADD CONSTRAINT "schedule_weekly_blocks_playlistId_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_weekly_blocks" ADD CONSTRAINT "schedule_weekly_blocks_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ADD CONSTRAINT "schedule_one_off_blocks_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ADD CONSTRAINT "schedule_one_off_blocks_playlistId_playlists_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."playlists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ADD CONSTRAINT "schedule_one_off_blocks_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_interruptions" ADD CONSTRAINT "playout_interruptions_radioId_radios_id_fk" FOREIGN KEY ("radioId") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_interruptions" ADD CONSTRAINT "playout_interruptions_mediaNodeId_media_nodes_id_fk" FOREIGN KEY ("mediaNodeId") REFERENCES "public"."media_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_interruptions" ADD CONSTRAINT "playout_interruptions_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "radiosSlugIndex" ON "radios" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "radiosNameIndex" ON "radios" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "media_nodes_radio_parent_name_index" ON "media_nodes" USING btree ("radioId","parentId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_radio_name_index" ON "playlists" USING btree ("radioId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_items_playlist_position_index" ON "playlist_items" USING btree ("playlistId","position");