ALTER TABLE "agents" ADD COLUMN "api_key" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_api_key_unique" UNIQUE("api_key");