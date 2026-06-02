import { pathToFileURL } from 'url';
import createApp from './app.js';
import config from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createShutdownManager } from './core/lifecycle.js';
import logger from './utils/logger.js';

export const startServer = async () => {
  let shutdownManager;

  const handleFatalError = (type, error) => {
    logger.error(`Fatal ${type}`, { error });
    if (shutdownManager) {
      shutdownManager.shutdown(type);
    } else {
      process.exit(1);
    }
  };

  const handleSignal = (signal) => {
    logger.info(`Received ${signal}`);
    if (shutdownManager) {
      shutdownManager.shutdown(signal);
    } else {
      process.exit(0);
    }
  };

  process.once('uncaughtException', (error) => handleFatalError('uncaughtException', error));
  process.once('unhandledRejection', (reason) => handleFatalError('unhandledRejection', reason));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));
  process.once('SIGINT', () => handleSignal('SIGINT'));

  await connectDatabase(config);

  const app = createApp();
  const server = app.listen(config.app.port, config.app.host);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  logger.info('HTTP server started', {
    service: config.app.name,
    env: config.env,
    host: typeof address === 'object' ? address.address : config.app.host,
    port: typeof address === 'object' ? address.port : config.app.port,
    apiPrefix: config.app.apiPrefix,
  });

  shutdownManager = createShutdownManager({
    server,
    config,
    cleanup: [disconnectDatabase],
  });

  return { app, server, shutdownManager };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}
