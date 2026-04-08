CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`subject` text,
	`body` text,
	`direction` text,
	`contact_id` text,
	`company_id` text,
	`deal_id` text,
	`metadata` text DEFAULT '{}',
	`occurred_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_activities_tenant_idx` ON `activities` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_activities_contact_idx` ON `activities` (`contact_id`);--> statement-breakpoint
CREATE INDEX `sqlite_activities_company_idx` ON `activities` (`company_id`);--> statement-breakpoint
CREATE INDEX `sqlite_activities_deal_idx` ON `activities` (`deal_id`);--> statement-breakpoint
CREATE INDEX `sqlite_activities_occurred_idx` ON `activities` (`tenant_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `agent_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`content` text NOT NULL,
	`confidence` real DEFAULT 0.5 NOT NULL,
	`ttl_seconds` integer,
	`promoted_at` text,
	`metadata` text DEFAULT '{}',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_agent_memories_tenant_idx` ON `agent_memories` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_agent_memories_agent_idx` ON `agent_memories` (`agent_id`);--> statement-breakpoint
CREATE INDEX `sqlite_agent_memories_subject_idx` ON `agent_memories` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'autonomous' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text DEFAULT 'operator' NOT NULL,
	`api_key` text,
	`owner_user_id` text,
	`policy_id` text,
	`metadata` text DEFAULT '{}',
	`last_active_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_api_key_unique` ON `agents` (`api_key`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by_agent_id` text,
	`reviewed_by_user_id` text,
	`title` text NOT NULL,
	`description` text,
	`metadata` text DEFAULT '{}',
	`expires_at` text,
	`reviewed_at` text,
	`review_note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_approvals_tenant_id_idx` ON `approvals` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_approvals_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `sqlite_approvals_requested_by_agent_id_idx` ON `approvals` (`requested_by_agent_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`filename` text NOT NULL,
	`url` text,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`data` text,
	`uploaded_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_attachments_tenant_idx` ON `attachments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_attachments_record_idx` ON `attachments` (`tenant_id`,`record_type`,`record_id`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`category` text,
	`contact_id` text,
	`company_id` text,
	`deal_id` text,
	`assigned_agent_id` text,
	`resolved_at` text,
	`custom_fields` text DEFAULT '{}',
	`created_by_agent_id` text,
	`updated_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_cases_tenant_idx` ON `cases` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_cases_status_idx` ON `cases` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `sqlite_cases_contact_idx` ON `cases` (`contact_id`);--> statement-breakpoint
CREATE INDEX `sqlite_cases_company_idx` ON `cases` (`company_id`);--> statement-breakpoint
CREATE INDEX `sqlite_cases_assigned_agent_idx` ON `cases` (`assigned_agent_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`industry` text,
	`size` text,
	`parent_company_id` text,
	`state_code` text DEFAULT 'active' NOT NULL,
	`status_code` text,
	`custom_fields` text DEFAULT '{}',
	`created_by_agent_id` text,
	`updated_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_companies_tenant_idx` ON `companies` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_companies_domain_idx` ON `companies` (`tenant_id`,`domain`);--> statement-breakpoint
CREATE INDEX `sqlite_companies_parent_idx` ON `companies` (`parent_company_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`email` text,
	`phone` text,
	`title` text,
	`company_id` text,
	`state_code` text DEFAULT 'active' NOT NULL,
	`status_code` text,
	`custom_fields` text DEFAULT '{}',
	`created_by_agent_id` text,
	`updated_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_contacts_tenant_idx` ON `contacts` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE INDEX `sqlite_contacts_email_idx` ON `contacts` (`tenant_id`,`email`);--> statement-breakpoint
CREATE TABLE `crm_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`event_type` text NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`agent_id` text,
	`user_id` text,
	`changes` text DEFAULT '{}',
	`metadata` text DEFAULT '{}',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_crm_events_tenant_idx` ON `crm_events` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_crm_events_record_idx` ON `crm_events` (`record_type`,`record_id`);--> statement-breakpoint
CREATE INDEX `sqlite_crm_events_type_idx` ON `crm_events` (`tenant_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `sqlite_crm_events_created_idx` ON `crm_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`collection` text NOT NULL,
	`field_name` text NOT NULL,
	`field_type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options` text,
	`default_value` text,
	`description` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_cfd_tenant_idx` ON `custom_field_definitions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_cfd_collection_idx` ON `custom_field_definitions` (`tenant_id`,`collection`);--> statement-breakpoint
CREATE UNIQUE INDEX `sqlite_cfd_tenant_collection_field` ON `custom_field_definitions` (`tenant_id`,`collection`,`field_name`);--> statement-breakpoint
CREATE TABLE `deal_contacts` (
	`deal_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role` text,
	PRIMARY KEY(`deal_id`, `contact_id`),
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_deal_contacts_deal_idx` ON `deal_contacts` (`deal_id`);--> statement-breakpoint
CREATE INDEX `sqlite_deal_contacts_contact_idx` ON `deal_contacts` (`contact_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`value` text,
	`currency` text DEFAULT 'USD',
	`stage` text NOT NULL,
	`pipeline_id` text NOT NULL,
	`company_id` text,
	`close_date` text,
	`owner_agent_id` text,
	`state_code` text DEFAULT 'active' NOT NULL,
	`status_code` text,
	`custom_fields` text DEFAULT '{}',
	`created_by_agent_id` text,
	`updated_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_deals_tenant_idx` ON `deals` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_deals_pipeline_idx` ON `deals` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `sqlite_deals_stage_idx` ON `deals` (`tenant_id`,`stage`);--> statement-breakpoint
CREATE INDEX `sqlite_deals_company_idx` ON `deals` (`company_id`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`tenant_id` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`record_type` text,
	`record_id` text,
	`agent_id` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_notifications_tenant_id_idx` ON `notifications` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlite_notifications_tenant_read_idx` ON `notifications` (`tenant_id`,`read`);--> statement-breakpoint
CREATE INDEX `sqlite_notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`stages` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `record_tags` (
	`tag_id` text NOT NULL,
	`record_id` text NOT NULL,
	`record_type` text NOT NULL,
	PRIMARY KEY(`tag_id`, `record_id`, `record_type`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_record_tags_tag_idx` ON `record_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `sqlite_record_tags_record_idx` ON `record_tags` (`record_id`,`record_type`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`object_type` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`settings` text DEFAULT '{}',
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'member' NOT NULL,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`webhook_id` text NOT NULL,
	`event_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`status_code` integer,
	`response_body` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`next_retry_at` text,
	`last_attempt_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `crm_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_webhook_deliveries_webhook_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `sqlite_webhook_deliveries_status_idx` ON `webhook_deliveries` (`status`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`event_types` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`description` text,
	`created_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlite_webhooks_tenant_idx` ON `webhooks` (`tenant_id`);