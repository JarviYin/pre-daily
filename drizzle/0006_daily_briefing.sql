DROP TABLE IF EXISTS "wc_push_log" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_issues" ADD COLUMN "briefing" jsonb;