CREATE TABLE "prospect_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scout_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" text NOT NULL,
	"generated_by" text NOT NULL,
	"target_area" jsonb NOT NULL,
	"received" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scout_batches_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "batch_id" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "canton" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "signals" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "suggested_services" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "reason_to_contact" text;--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_exclusions_type_value_idx" ON "prospect_exclusions" USING btree ("type","normalized_value");
--> statement-breakpoint
INSERT INTO "prospect_exclusions" ("type", "value", "normalized_value", "reason") VALUES
('CANTON', 'Coto Brus', 'coto brus', 'Exclusión geográfica inicial'),
('CITY', 'San Vito', 'san vito', 'Exclusión geográfica inicial'),
('CITY', 'Sabalito', 'sabalito', 'Exclusión geográfica inicial')
ON CONFLICT DO NOTHING;
