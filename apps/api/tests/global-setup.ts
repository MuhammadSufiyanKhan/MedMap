import { connect } from 'node:net';

const LOCAL_MONGO = { host: '127.0.0.1', port: 27017 };

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (ok: boolean): void => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(750, () => {
      finish(false);
    });
    socket.once('connect', () => {
      finish(true);
    });
    socket.once('error', () => {
      finish(false);
    });
  });
}

/**
 * Chooses the MongoDB used by the integration tests, in this order:
 *
 * 1. `MONGO_TEST_URI` when set (a service container in CI).
 * 2. A MongoDB already listening on localhost:27017 (`npm run db:up`).
 * 3. mongodb-memory-server as a fallback. It downloads a MongoDB binary on first use,
 *    which is blocked in some sandboxes, so it is never the only option.
 */
export default async function setup(): Promise<() => Promise<void>> {
  if (process.env.MONGO_TEST_URI !== undefined && process.env.MONGO_TEST_URI !== '') {
    return () => Promise.resolve();
  }
  if (await canConnect(LOCAL_MONGO.host, LOCAL_MONGO.port)) {
    process.env.MONGO_TEST_URI = `mongodb://${LOCAL_MONGO.host}:${String(LOCAL_MONGO.port)}`;
    return () => Promise.resolve();
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  process.env.MONGO_TEST_URI = server.getUri();
  return async () => {
    await server.stop();
  };
}
