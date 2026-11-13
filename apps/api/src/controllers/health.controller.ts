import type { RequestHandler } from 'express';

/** Liveness: the process is up. Does not touch dependencies. */
export const healthz: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' });
};

/** Readiness: the process can serve traffic, which needs a working MongoDB connection. */
export function readyz(pingDatabase: () => Promise<boolean>): RequestHandler {
  return async (_req, res) => {
    const mongoOk = await pingDatabase();
    res.status(mongoOk ? 200 : 503).json({
      status: mongoOk ? 'ok' : 'unavailable',
      checks: { mongo: mongoOk ? 'ok' : 'unavailable' },
    });
  };
}
