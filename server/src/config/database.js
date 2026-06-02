import { getPrisma } from '../lib/prisma.js';
import logger from '../utils/logger.js';

export const connectDatabase = async (config) => {
  if (!config.database.enabled) {
    logger.info('Database connection disabled');
    return null;
  }

  if (!config.database.url) {
    throw new Error('DATABASE_URL is required when DATABASE_ENABLED=true');
  }

  const prisma = getPrisma();
  await prisma.$connect();
  logger.info('PostgreSQL connected');
  return prisma;
};

export const disconnectDatabase = async () => {
  const prisma = getPrisma();
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
};
