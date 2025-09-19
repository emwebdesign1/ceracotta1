// backend/src/lib/prisma.js
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// Évite de recréer le client en dev (hot reload nodemon)
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'], // mets 'query' si tu veux voir les requêtes
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
