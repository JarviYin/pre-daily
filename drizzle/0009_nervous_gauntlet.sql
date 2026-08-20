CREATE TABLE "seo_reports" (
	"date" text PRIMARY KEY NOT NULL,
	"topics_refreshed" integer DEFAULT 0 NOT NULL,
	"new_topics" integer DEFAULT 0 NOT NULL,
	"urls_pinged" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impressions" integer,
	"clicks" integer,
	"top_queries" jsonb,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report_text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_topics" (
	"slug" text PRIMARY KEY NOT NULL,
	"zh_title" text NOT NULL,
	"meta_title" text NOT NULL,
	"meta_description" text NOT NULL,
	"h1" text NOT NULL,
	"intro" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"market_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen" text NOT NULL,
	"last_updated" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL
);
