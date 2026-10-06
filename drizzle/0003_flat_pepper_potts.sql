ALTER TABLE "messages" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_id_unique" UNIQUE("request_id");