CREATE TABLE "daily_issues" (
	"date" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"model_id" text NOT NULL,
	"summary_model_id" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_date" text NOT NULL,
	"rank" integer NOT NULL,
	"market_id" text NOT NULL,
	"slug" text NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"volume" double precision DEFAULT 0 NOT NULL,
	"volume_24hr" double precision DEFAULT 0 NOT NULL,
	"liquidity" double precision DEFAULT 0 NOT NULL,
	"end_date" text,
	"leading_change" double precision,
	"outcomes" jsonb NOT NULL,
	"analysis" jsonb
);
--> statement-breakpoint
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_issue_date_daily_issues_date_fk" FOREIGN KEY ("issue_date") REFERENCES "public"."daily_issues"("date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_items_date_rank_idx" ON "issue_items" USING btree ("issue_date","rank");