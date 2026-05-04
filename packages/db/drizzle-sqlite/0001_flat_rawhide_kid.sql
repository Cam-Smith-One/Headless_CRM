CREATE TABLE `pipeline_triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`pipeline_id` text NOT NULL,
	`trigger_event` text NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sqlt_pipeline_triggers_tenant_idx` ON `pipeline_triggers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sqlt_pipeline_triggers_pipeline_idx` ON `pipeline_triggers` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `sqlt_pipeline_triggers_event_idx` ON `pipeline_triggers` (`tenant_id`,`trigger_event`);