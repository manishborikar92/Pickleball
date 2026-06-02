import logger from '../utils/logger.js';

export const createShutdownManager = ({
  server,
  config,
  cleanup = [],
  exit = process.exit,
} = {}) => {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received; starting graceful shutdown`);

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out');
      exit(1);
    }, config.app.shutdownTimeoutMs);
    forceExitTimer.unref?.();

    try {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }

      let cleanupFailed = false;
      for (const task of cleanup) {
        try {
          await task();
        } catch (taskError) {
          logger.error('Cleanup task failed', { error: taskError });
          cleanupFailed = true;
        }
      }

      clearTimeout(forceExitTimer);
      if (cleanupFailed) {
        logger.error('Graceful shutdown completed with errors');
        exit(1);
      } else {
        logger.info('Graceful shutdown complete');
        exit(0);
      }
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error('Graceful shutdown failed', { error });
      exit(1);
    }
  };

  return { shutdown };
};
