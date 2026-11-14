import { loadConfig } from '../config/env.js';
import type { AppConfig } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../repositories/db.js';

/**
 * Runs a command-line job with a database connection and a clean exit code.
 * Output goes to stdout/stderr directly because jobs are run by people and pipelines.
 */
export function runJob(
  name: string,
  job: (config: AppConfig, print: (line: string) => void) => Promise<void>,
): void {
  const print = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  const main = async (): Promise<void> => {
    const config = loadConfig();
    await connectDatabase(config.mongoUri, { autoIndex: false });
    try {
      await job(config, print);
    } finally {
      await disconnectDatabase();
    }
  };
  main().catch((error: unknown) => {
    process.stderr.write(
      `${name} failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exit(1);
  });
}
