ALTER TABLE "issue_items" ADD COLUMN "volume_1wk" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_items" ADD COLUMN "move_24h" double precision;--> statement-breakpoint
ALTER TABLE "issue_items" ADD COLUMN "surge" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_items" ADD COLUMN "is_new" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_items" ADD COLUMN "role" text DEFAULT 'heat' NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_items" ADD COLUMN "heat_score" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_items" ADD COLUMN "badges" jsonb DEFAULT '[]'::jsonb NOT NULL;