-- CreateTable
CREATE TABLE `SurveyResponse` (
    `id` VARCHAR(191) NOT NULL,
    `choice` ENUM('MUGS_COLORFUL', 'PLATES_MINIMAL', 'BOWLS_GENEROUS', 'OTHER') NOT NULL,
    `otherText` VARCHAR(255) NULL,
    `email` VARCHAR(190) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SurveyResponse_createdAt_idx`(`createdAt`),
    INDEX `SurveyResponse_choice_idx`(`choice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
