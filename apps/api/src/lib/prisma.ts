import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../generated/prisma/client.js';
import {env} from '../config/env.js';

const prismaGlobal = globalThis as typeof globalThis & {otherHalfPrisma?: PrismaClient};
const adapter = new PrismaPg({connectionString: env.DATABASE_URL});

export const prisma =
  prismaGlobal.otherHalfPrisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') prismaGlobal.otherHalfPrisma = prisma;
