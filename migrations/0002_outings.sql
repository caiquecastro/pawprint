CREATE TABLE `outings` (
  `id` text PRIMARY KEY NOT NULL,
  `pet_id` text NOT NULL REFERENCES `pets` (`id`) ON DELETE CASCADE,
  `kind` text NOT NULL CHECK (`kind` IN ('walk', 'potty')),
  `started_at` text NOT NULL,
  `ended_at` text,
  `pee_count` integer CHECK (`pee_count` IS NULL OR (`pee_count` BETWEEN 0 AND 999)),
  `poop_count` integer CHECK (`poop_count` IS NULL OR (`poop_count` BETWEEN 0 AND 999)),
  `notes` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `deleted_at` text
);
CREATE INDEX `outings_pet_started_idx` ON `outings` (`pet_id`, `started_at`);
