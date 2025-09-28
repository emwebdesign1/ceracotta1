-- DropForeignKey
ALTER TABLE `variant` DROP FOREIGN KEY `Variant_productId_fkey`;

-- DropIndex
DROP INDEX `Variant_sku_key` ON `variant`;

-- CreateTable
CREATE TABLE `Image` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `productId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `colorHex` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Variant` ADD CONSTRAINT `Variant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Image` ADD CONSTRAINT `Image_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Image` ADD CONSTRAINT `Image_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `Variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
