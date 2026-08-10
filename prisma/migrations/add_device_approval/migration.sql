ALTER TABLE `devices`
  ADD COLUMN `need_approval` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `date_approved` TIMESTAMP NULL;

CREATE INDEX `idx_devices_need_approval` ON `devices`(`need_approval`);
