ALTER TABLE "schedule_weekly_blocks" ALTER COLUMN "modeAfterPlayback" SET DEFAULT 'overlay';--> statement-breakpoint
ALTER TABLE "schedule_one_off_blocks" ALTER COLUMN "modeAfterPlayback" SET DEFAULT 'overlay';--> statement-breakpoint
ALTER TABLE "playout_interruptions" ALTER COLUMN "modeAfterPlayback" SET DEFAULT 'overlay';