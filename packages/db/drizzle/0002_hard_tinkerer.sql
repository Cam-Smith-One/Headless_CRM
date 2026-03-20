CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"event_types" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"collection" text NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"default_value" jsonb,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cfd_tenant_collection_field" UNIQUE("tenant_id","collection","field_name")
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_crm_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."crm_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhooks_tenant_idx" ON "webhooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cfd_tenant_idx" ON "custom_field_definitions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cfd_collection_idx" ON "custom_field_definitions" USING btree ("tenant_id","collection");