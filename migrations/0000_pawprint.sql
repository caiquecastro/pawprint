PRAGMA foreign_keys = ON;

CREATE TABLE `pets` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `species` text NOT NULL, `breed` text, `birth_date` text, `approximate_birth_date` integer DEFAULT false NOT NULL, `current_weight` real, `weight_unit` text DEFAULT 'kg' NOT NULL, `avatar_object_key` text, `owner_id` text DEFAULT 'single-owner' NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL);
CREATE TABLE `journal_entries` (`id` text PRIMARY KEY NOT NULL, `pet_id` text NOT NULL REFERENCES `pets`(`id`) ON DELETE cascade, `type` text NOT NULL, `occurred_at` text NOT NULL, `title` text NOT NULL, `body` text NOT NULL, `mood` text, `created_at` text NOT NULL, `updated_at` text NOT NULL, `deleted_at` text);
CREATE INDEX `journal_pet_occurred_idx` ON `journal_entries` (`pet_id`,`occurred_at`); CREATE INDEX `journal_updated_idx` ON `journal_entries` (`updated_at`);
CREATE TABLE `measurements` (`id` text PRIMARY KEY NOT NULL, `pet_id` text NOT NULL REFERENCES `pets`(`id`) ON DELETE cascade, `type` text NOT NULL, `numeric_value` real, `unit` text, `measured_at` text NOT NULL, `note` text, `created_at` text NOT NULL, `updated_at` text NOT NULL, `deleted_at` text);
CREATE INDEX `measurements_pet_measured_idx` ON `measurements` (`pet_id`,`measured_at`);
CREATE TABLE `care_reminders` (`id` text PRIMARY KEY NOT NULL, `pet_id` text NOT NULL REFERENCES `pets`(`id`) ON DELETE cascade, `title` text NOT NULL, `notes` text, `due_at` text NOT NULL, `recurrence_rule` text, `completed_at` text, `created_at` text NOT NULL, `updated_at` text NOT NULL, `deleted_at` text);
CREATE INDEX `reminders_pet_due_idx` ON `care_reminders` (`pet_id`,`due_at`); CREATE INDEX `reminders_completed_idx` ON `care_reminders` (`completed_at`);
CREATE TABLE `media` (`id` text PRIMARY KEY NOT NULL, `pet_id` text NOT NULL REFERENCES `pets`(`id`) ON DELETE cascade, `journal_entry_id` text REFERENCES `journal_entries`(`id`) ON DELETE set null, `object_key` text NOT NULL UNIQUE, `mime_type` text NOT NULL, `width` integer, `height` integer, `created_at` text NOT NULL);
CREATE INDEX `media_pet_idx` ON `media` (`pet_id`); CREATE INDEX `media_journal_idx` ON `media` (`journal_entry_id`);
CREATE TABLE `processed_mutations` (`id` text PRIMARY KEY NOT NULL, `entity_id` text NOT NULL, `processed_at` text NOT NULL);
