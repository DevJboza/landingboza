ALTER TYPE "public"."sender_type" ADD VALUE 'CUSTOMER' BEFORE 'AGENT';--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "external_chat_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_external_chat_id_unique" UNIQUE("external_chat_id");