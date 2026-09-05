import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for migrations.');

const migrationsPath = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(migrationsPath)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (applied.rowCount) continue;
    const migration = await readFile(join(migrationsPath, name), 'utf8');
    await pool.query(migration);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    console.log(`Applied ${name}`);
  }
} finally {
  await pool.end();
}
