ALTER TABLE `processed_mutations` ADD `owner_id` text DEFAULT 'single-owner' NOT NULL;
CREATE INDEX `pets_owner_idx` ON `pets` (`owner_id`);
CREATE INDEX `processed_mutations_owner_idx` ON `processed_mutations` (`owner_id`);
