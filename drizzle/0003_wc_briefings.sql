CREATE TABLE "wc_briefings" (
	"date" text PRIMARY KEY NOT NULL,
	"phase" text NOT NULL,
	"angle_key" text NOT NULL,
	"title" text NOT NULL,
	"headline" text NOT NULL,
	"lede" text NOT NULL,
	"team_focus" jsonb NOT NULL,
	"odds_snapshot" jsonb NOT NULL,
	"look_ahead" text NOT NULL,
	"model_id" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL
);
