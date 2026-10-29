/**
 * Migraciones versionadas de PostgreSQL.
 *
 *   npm run db:migrate
 *
 * Aplica, en orden, los archivos `server/db/migrations/NNN_nombre.sql` que
 * aún no figuran en `schema_migrations`. Cada migración corre en su propia
 * transacción. Si un archivo ya aplicado cambió, se detiene: las migraciones
 * no se editan, se añade una nueva.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const DIR = fileURLToPath(new URL('./migrations/', import.meta.url));
const FILE = /^(\d{3})_[\w-]+\.sql$/;
// Evita que dos procesos migren a la vez.
const LOCK_KEY = 7_253_771;

export async function listMigrations() {
  const files = (await readdir(DIR)).filter((f) => FILE.test(f)).sort();
  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(DIR + name, 'utf8');
      return { version: Number(name.match(FILE)[1]), name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

/** @returns {Promise<string[]>} nombres de las migraciones aplicadas en esta ejecución */
export async function migrate(pool, { log = () => {} } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    integer PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT version, name, checksum FROM schema_migrations');
    const done = new Map(rows.map((r) => [r.version, r]));
    const applied = [];
    for (const m of await listMigrations()) {
      const prev = done.get(m.version);
      if (prev) {
        if (prev.checksum !== m.checksum) throw new Error(`La migración ${m.name} cambió después de aplicarse. Crea una migración nueva en lugar de editarla.`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${m.name}: ${error.message}`, { cause: error });
      }
      log(`Migración aplicada: ${m.name}`);
      applied.push(m.name);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

// Ejecución directa: `node server/db/migrate.js`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pool = createPool(process.env.DATABASE_URL);
  if (!pool) {
    console.error('Falta DATABASE_URL. Defínela en .env (ver .env.example).');
    process.exit(1);
  }
  try {
    const applied = await migrate(pool, { log: (m) => console.log(m) });
    console.log(applied.length ? `Listo: ${applied.length} migración(es) aplicada(s).` : 'La base de datos ya está al día.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
