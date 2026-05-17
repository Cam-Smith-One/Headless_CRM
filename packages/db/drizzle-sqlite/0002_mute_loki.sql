CREATE TABLE `saved_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`collection` text NOT NULL,
	`filters` text DEFAULT '{}' NOT NULL,
	`created_by_agent_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlt_saved_searches_tenant_idx` ON `saved_searches` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlt_saved_searches_collection_idx` ON `saved_searches` (`tenant_id`,`collection`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pipeline_triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`pipeline_id` text NOT NULL,
	`trigger_type` text DEFAULT 'email_event' NOT NULL,
	`trigger_event` text,
	`condition_field` text,
	`condition_operator` text,
	`condition_value` text,
	`check_interval_minutes` integer,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pipeline_triggers`("id", "tenant_id", "pipeline_id", "trigger_type", "trigger_event", "condition_field", "condition_operator", "condition_value", "check_interval_minutes", "from_stage", "to_stage", "active", "created_at", "updated_at") SELECT "id", "tenant_id", "pipeline_id", 'email_event', "trigger_event", NULL, NULL, NULL, NULL, "from_stage", "to_stage", "active", "created_at", "updated_at" FROM `pipeline_triggers`;--> statement-breakpoint
DROP TABLE `pipeline_triggers`;--> statement-breakpoint
ALTER TABLE `__new_pipeline_triggers` RENAME TO `pipeline_triggers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sqlt_pipeline_triggers_tenant_idx` ON `pipeline_triggers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlt_pipeline_triggers_pipeline_idx` ON `pipeline_triggers` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `sqlt_pipeline_triggers_event_idx` ON `pipeline_triggers` (`tenant_id`,`trigger_event`);--> statement-breakpoint
ALTER TABLE `cases` ADD `due_at` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `sla_hours` integer;