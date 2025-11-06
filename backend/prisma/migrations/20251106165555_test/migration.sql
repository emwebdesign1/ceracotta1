-- DropForeignKey
ALTER TABLE `wishlistitem` DROP FOREIGN KEY `WishlistItem_userId_fkey`;

-- AddForeignKey
ALTER TABLE `wishlistitem` ADD CONSTRAINT `WishlistItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
