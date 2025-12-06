-- DropForeignKey
ALTER TABLE `event` DROP FOREIGN KEY `Event_sessionId_fkey`;

-- AlterTable
ALTER TABLE `event` ADD COLUMN `utmCampaign` VARCHAR(191) NULL,
    ADD COLUMN `utmMedium` VARCHAR(191) NULL,
    ADD COLUMN `utmSource` VARCHAR(191) NULL,
    ADD COLUMN `visitorId` VARCHAR(191) NULL,
    MODIFY `sessionId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `event` ADD CONSTRAINT `event_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event` ADD CONSTRAINT `event_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `event` RENAME INDEX `Event_createdAt_idx` TO `event_createdAt_idx`;

-- RenameIndex
ALTER TABLE `event` RENAME INDEX `Event_productId_createdAt_idx` TO `event_productId_createdAt_idx`;

-- RenameIndex
ALTER TABLE `event` RENAME INDEX `Event_sessionId_idx` TO `event_sessionId_idx`;

-- RenameIndex
ALTER TABLE `event` RENAME INDEX `Event_type_createdAt_idx` TO `event_type_createdAt_idx`;
