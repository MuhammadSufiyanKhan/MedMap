import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase, pingDatabase } from './repositories/db.js';
import { UnauthorizedError } from './utils/errors.js';
import { createLogger } from './utils/logger.js';
import { installGracefulShutdown } from './utils/shutdown.js';
import { readVersion } from './utils/version.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv === 'development' });

  await connectDatabase(config.mongoUri, { autoIndex: !config.isProduction });

  const app = buildApp({
    config,
    logger,
    routes: [],
    verifyAccessToken: () => {
      throw new UnauthorizedError();
    },
    idempotency: {
      begin: () => Promise.resolve(null),
      complete: () => Promise.resolve(),
      abandon: () => Promise.resolve(),
    },
    multipart: (_req, _res, next) => {
      next();
    },
    pingDatabase,
    version: readVersion(),
  });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'api listening');
  });
  installGracefulShutdown({ server, logger, cleanup: disconnectDatabase });
}

main().catch((error: unknown) => {
  // The logger may not exist yet, so write the startup failure directly.
  const message =
    error instanceof ConfigError || error instanceof Error ? error.message : 'unknown';
  process.stderr.write(`API failed to start: ${message}\n`);
  process.exit(1);
});
