CREATE TABLE "pipeline_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"trigger_event" text NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD CONSTRAINT "pipeline_triggers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_triggers" ADD CONSTRAINT "pipeline_triggers_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_triggers_tenant_idx" ON "pipeline_triggers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pipeline_triggers_pipeline_idx" ON "pipeline_triggers" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_triggers_event_idx" ON "pipeline_triggers" USING btree ("tenant_id","trigger_event");