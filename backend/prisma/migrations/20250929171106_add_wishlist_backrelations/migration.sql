/*
  Warnings:

  - You are about to drop the column `addressLine1` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `addressLine2` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `zip` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `dailyproductstat` ADD COLUMN `favorites` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `event` MODIFY `type` ENUM('PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'REMOVE_FROM_CART', 'BEGIN_CHECKOUT', 'PURCHASE', 'FAVORITE_ADD', 'FAVORITE_REMOVE') NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `addressLine1`,
    DROP COLUMN `addressLine2`,
    DROP COLUMN `city`,
    DROP COLUMN `country`,
    DROP COLUMN `zip`;

-- CreateTable
CREATE TABLE `WishlistItem` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WishlistItem_productId_createdAt_idx`(`productId`, `createdAt`),
    UNIQUE INDEX `WishlistItem_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnonWishlistItem` (
    `id` VARCHAR(191) NOT NULL,
    `visitorId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnonWishlistItem_productId_createdAt_idx`(`productId`, `createdAt`),
    UNIQUE INDEX `AnonWishlistItem_visitorId_productId_key`(`visitorId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DailyProductStat_date_idx` ON `DailyProductStat`(`date`);

-- CreateIndex
CREATE INDEX `Event_productId_createdAt_idx` ON `Event`(`productId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnonWishlistItem` ADD CONSTRAINT `AnonWishlistItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
