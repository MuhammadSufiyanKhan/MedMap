import { ConfigError, loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { connectDatabase, disconnectDatabase } from './repositories/db.js';
import { createLogger } from './utils/logger.js';
import { installGracefulShutdown } from './utils/shutdown.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv === 'development' });

  await connectDatabase(config.mongoUri, { autoIndex: !config.isProduction });

  const { app, datasets } = createContainer(config, logger);

  // Safety rule 6: never serve the demo dataset from production by accident.
  const dataset = await datasets.assertStartupGuard({
    isProduction: config.isProduction,
    allowDemoData: config.allowDemoData,
  });
  if (dataset === null) {
    logger.warn('no interaction dataset is active; interaction checks will answer 503');
  } else {
    logger.info(
      { dataset: dataset.name, version: dataset.version, kind: dataset.kind },
      'active interaction dataset',
    );
  }

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
