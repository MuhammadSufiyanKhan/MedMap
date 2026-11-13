import type { Server } from 'node:http';
import type { Logger } from './logger.js';

/**
 * Stops the server gracefully on SIGTERM/SIGINT: stop accepting connections, let in-flight
 * requests finish, then run `cleanup` (closing MongoDB). A hard exit follows if that takes
 * longer than `timeoutMs`, so a stuck request cannot block a deploy.
 */
export function installGracefulShutdown(options: {
  server: Server;
  logger: Logger;
  cleanup: () => Promise<void>;
  timeoutMs?: number;
}): void {
  const { server, logger, cleanup, timeoutMs = 10_000 } = options;
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs);
    forceExit.unref();

    server.close((closeError) => {
      cleanup()
        .catch((cleanupError: unknown) => {
          logger.error({ err: cleanupError }, 'cleanup failed');
        })
        .finally(() => {
          logger.info('shutdown complete');
          process.exit(closeError ? 1 : 0);
        });
    });
    // Idle keep-alive sockets would otherwise hold the server open until they time out.
    server.closeIdleConnections();
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}
