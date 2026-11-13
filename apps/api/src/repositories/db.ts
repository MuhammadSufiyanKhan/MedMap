import mongoose from 'mongoose';
import { ALL_MODELS } from '../models/index.js';

/**
 * Opens the MongoDB connection. Indexes are built automatically outside production;
 * in production they are created only by the migration job, never by a web process.
 */
export async function connectDatabase(uri: string, options: { autoIndex: boolean }): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: options.autoIndex,
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** True when the connection is open and the server answers a ping. Used by `/readyz`. */
export async function pingDatabase(): Promise<boolean> {
  try {
    const db = mongoose.connection.db;
    if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected || !db) {
      return false;
    }
    await db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

/** Creates every declared index and reports what exists afterwards. Idempotent. */
export async function ensureIndexes(): Promise<{ collection: string; indexes: number }[]> {
  const report: { collection: string; indexes: number }[] = [];
  for (const model of ALL_MODELS) {
    await model.createIndexes();
    const indexes = await model.collection.indexes();
    report.push({ collection: model.collection.collectionName, indexes: indexes.length });
  }
  return report;
}

/** Drops the whole database. Refuses to run unless the database name marks it as a test DB. */
export async function dropTestDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db?.databaseName.includes('test')) {
    throw new Error('Refusing to drop a database whose name does not contain "test"');
  }
  await db.dropDatabase();
}
