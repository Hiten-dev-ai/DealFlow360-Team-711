import { MemoryStore } from './memory-store.js';
import { PostgresStore } from './postgres-store.js';

export function createStore(config) {
  if (config.databaseUrl) return new PostgresStore(config);
  if (config.nodeEnv === 'production') {
    throw new Error('DATABASE_URL is required in production.');
  }
  return new MemoryStore(config);
}
