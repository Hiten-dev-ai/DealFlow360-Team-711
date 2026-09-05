import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for migrations.');

const migrationPath = join(dirname(fileURLToPath(import.meta.url)), 'migrations', '0001_foundation.sql');
const migration = await readFile(migrationPath, 'utf8');
const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query(migration);
  console.log('Database foundation migration applied.');
} finally {
  await pool.end();
}
