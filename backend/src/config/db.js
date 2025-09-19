// src/config/db.js
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();   // named export
export default prisma;                      // optional default (for flexibility)

// (Optional) tiny helper to close gracefully if you want:
// process.on('beforeExit', async () => { await prisma.$disconnect(); });
