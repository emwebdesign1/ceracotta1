-- DropIndex
DROP INDEX `User_email_idx` ON `user`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `addressLine1` VARCHAR(191) NULL,
    ADD COLUMN `addressLine2` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NULL,
    ADD COLUMN `zip` VARCHAR(191) NULL;
