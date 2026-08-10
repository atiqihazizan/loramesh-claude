-- AlterTable
ALTER TABLE `agency` ADD COLUMN `agency_token_expires_at` TIMESTAMP(0) NULL;

-- DropTable
DROP TABLE `provisioning_nonce`;
