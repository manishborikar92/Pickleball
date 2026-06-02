import { Router } from 'express';

import { getDatabaseHealth } from '../../lib/prisma.js';
import { ApiResponse } from '../../utils/api-response.js';

export const createHealthRouter = ({ startedAt = new Date(), config } = {}) => {
  const router = Router();

  router.get('/health', async (_req, res, next) => {
    try {
      const database = await getDatabaseHealth({ enabled: Boolean(config?.database?.enabled) });

    res.json(ApiResponse.success({
      status: 'ok',
      service: config?.app?.name || 'api',
      environment: config?.env || process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      process: {
        nodeVersion: process.version,
        pid: process.pid,
        memoryMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      },
        database,
    }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/live', (_req, res) => {
    res.json(ApiResponse.success({ status: 'alive' }));
  });

  router.get('/ready', async (_req, res, next) => {
    try {
      const database = await getDatabaseHealth({ enabled: Boolean(config?.database?.enabled) });
      const statusCode = database.ready ? 200 : 503;

      res.status(statusCode).json(ApiResponse.success({
        status: database.ready ? 'ready' : 'not_ready',
        database,
      }));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
