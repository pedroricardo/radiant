ALTER TABLE "schedule_weekly_blocks"
ADD COLUMN "playlistFillMode" text;
--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks"
ADD COLUMN "playlistFillMode" text;
