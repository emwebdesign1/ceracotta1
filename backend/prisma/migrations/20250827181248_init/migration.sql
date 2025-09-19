/*
  Warnings:

  - You are about to drop the column `active` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `characteristics` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Product_createdAt_idx` ON `product`;

-- AlterTable
ALTER TABLE `cartitem` ADD COLUMN `variantId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `variantId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `active`,
    DROP COLUMN `characteristics`,
    DROP COLUMN `images`,
    ADD COLUMN `careAdvice` VARCHAR(191) NULL,
    ADD COLUMN `pieceDetail` VARCHAR(191) NULL,
    ADD COLUMN `shippingReturn` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `ProductImage_productId_idx`(`productId`),
    UNIQUE INDEX `ProductImage_productId_position_key`(`productId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductColor` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `hex` VARCHAR(191) NULL,

    INDEX `ProductColor_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Variant` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `price` INTEGER NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Variant_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CartItem_variantId_idx` ON `CartItem`(`variantId`);

-- CreateIndex
CREATE INDEX `OrderItem_variantId_idx` ON `OrderItem`(`variantId`);

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductColor` ADD CONSTRAINT `ProductColor_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Variant` ADD CONSTRAINT `Variant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CartItem` ADD CONSTRAINT `CartItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `Variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `Variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
