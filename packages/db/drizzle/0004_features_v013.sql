-- v0.1.3 feature additions:
-- 1. Case SLA fields (due_at, sla_hours)
-- 2. Pipeline trigger extended fields (trigger_type, condition_*, check_interval_minutes)
-- 3. Saved searches table

ALTER TABLE "cases" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "sla_hours" integer;--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD COLUMN "trigger_type" text NOT NULL DEFAULT 'email_event';--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD COLUMN "condition_field" text;--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD COLUMN "condition_operator" text;--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD COLUMN "condition_value" text;--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD COLUMN "check_interval_minutes" integer;--> statement-breakpoint
-- triggerEvent is now optional (null for non-email triggers)
ALTER TABLE "pipeline_triggers" ALTER COLUMN "trigger_event" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"collection" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_searches_tenant_idx" ON "saved_searches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "saved_searches_collection_idx" ON "saved_searches" USING btree ("tenant_id","collection");
