/**
 * src/lib/prisma.ts
 *
 * Singleton de PrismaClient para evitar abrir nuevas conexiones por cada
 * hot-reload en dev. En producción serverless (Vercel), cada function
 * instance crea su propia conexión — el tuning real va en DATABASE_URL
 * (connection_limit=5, pool_timeout=20).
 *
 * Logs:
 *  - dev: ['error', 'warn']
 *  - prod: ['error'] únicamente
 *
 * Compatible con Prisma 5.x. Migración futura a Neon Serverless Driver
 * en Sprint pre-piloto (Fase 2 del plan de conexiones).
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === 'development'
                ? ['error', 'warn']
                : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
