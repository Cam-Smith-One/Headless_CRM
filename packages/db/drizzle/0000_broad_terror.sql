CREATE TYPE "public"."agent_role" AS ENUM('reader', 'operator', 'developer', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('active', 'suspended', 'decommissioned');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('autonomous', 'supervised', 'scheduled', 'reactive');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('call', 'email', 'meeting', 'note', 'task', 'agent_action');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "agent_type" DEFAULT 'autonomous' NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"role" "agent_role" DEFAULT 'operator' NOT NULL,
	"owner_user_id" text,
	"policy_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"title" text,
	"company_id" text,
	"state_code" text DEFAULT 'active' NOT NULL,
	"status_code" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"created_by_agent_id" text,
	"updated_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"parent_company_id" text,
	"state_code" text DEFAULT 'active' NOT NULL,
	"status_code" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"created_by_agent_id" text,
	"updated_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_contacts" (
	"deal_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"role" text
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"value" numeric,
	"currency" text DEFAULT 'USD',
	"stage" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"company_id" text,
	"close_date" timestamp with time zone,
	"owner_agent_id" text,
	"state_code" text DEFAULT 'active' NOT NULL,
	"status_code" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"created_by_agent_id" text,
	"updated_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"stages" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"subject" text,
	"body" text,
	"direction" text,
	"contact_id" text,
	"company_id" text,
	"deal_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_tags" (
	"tag_id" text NOT NULL,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"object_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"content" text NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"ttl_seconds" integer,
	"promoted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"event_type" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"agent_id" text,
	"user_id" text,
	"changes" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text,
	"contact_id" text,
	"company_id" text,
	"deal_id" text,
	"assigned_agent_id" text,
	"resolved_at" timestamp with time zone,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"created_by_agent_id" text,
	"updated_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_tags" ADD CONSTRAINT "record_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_events" ADD CONSTRAINT "crm_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_agent_id_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "companies_tenant_idx" ON "companies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX "companies_parent_idx" ON "companies" USING btree ("parent_company_id");--> statement-breakpoint
CREATE INDEX "deal_contacts_deal_idx" ON "deal_contacts" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_contacts_contact_idx" ON "deal_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_idx" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deals_pipeline_idx" ON "deals" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "deals_company_idx" ON "deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "activities_tenant_idx" ON "activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "activities_contact_idx" ON "activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "activities_company_idx" ON "activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "activities_deal_idx" ON "activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "activities_occurred_idx" ON "activities" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "record_tags_tag_idx" ON "record_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "record_tags_record_idx" ON "record_tags" USING btree ("record_id","record_type");--> statement-breakpoint
CREATE INDEX "agent_memories_tenant_idx" ON "agent_memories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agent_memories_agent_idx" ON "agent_memories" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_memories_subject_idx" ON "agent_memories" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "crm_events_tenant_idx" ON "crm_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "crm_events_record_idx" ON "crm_events" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "crm_events_type_idx" ON "crm_events" USING btree ("tenant_id","event_type");--> statement-breakpoint
CREATE INDEX "crm_events_created_idx" ON "crm_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "cases_tenant_idx" ON "cases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "cases_contact_idx" ON "cases" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "cases_company_idx" ON "cases" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cases_assigned_agent_idx" ON "cases" USING btree ("assigned_agent_id");