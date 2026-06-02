import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import logger from '../utils/logger.js';

let prismaInstance;

export const getPrisma = () => {
  if (prismaInstance) {
    return prismaInstance;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  prismaInstance = new PrismaClient({ adapter });
  return prismaInstance;
};

export const disconnectPrisma = async () => {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = undefined;
  }
};

export const getDatabaseHealth = async ({ enabled = false } = {}) => {
  if (!enabled) {
    return {
      provider: 'postgresql',
      state: 'disabled',
      ready: true,
    };
  }

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    return {
      provider: 'postgresql',
      state: 'connected',
      ready: true,
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      provider: 'postgresql',
      state: 'unavailable',
      ready: false,
      error: 'Database connection failed',
    };
  }
};
