/**
 * Carga el catálogo sintético de empleos en PostgreSQL.
 *
 *   npm run catalog:synthetic
 *
 * Reproducible e idempotente: una transacción; cada empleo, competencia y
 * requisito se inserta o actualiza por su clave, así que volver a ejecutarla
 * no duplica nada. Si los datos cambian, las competencias o requisitos que ya
 * no figuran se retiran SOLO de los empleos sintéticos; y los empleos
 * sintéticos que ya no están en el catálogo se eliminan para que queden
 * exactamente los del archivo. Nunca toca ocupaciones no sintéticas.
 */
import { fileURLToPath } from 'node:url';
import { syncCatalog } from '../db/catalog.js';
import { createPool } from '../db/pool.js';
import { CATALOG_VERSION, SYNTHETIC_JOBS, validateCatalog } from './synthetic.js';

const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/)?.[0] || s).trim();

export async function loadSyntheticCatalog(pool) {
  const errors = validateCatalog();
  if (errors.length) throw new Error(`El catálogo no es válido:\n- ${errors.join('\n- ')}`);
  await syncCatalog(pool); // las competencias referenciadas deben existir

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const j of SYNTHETIC_JOBS) {
      await client.query(
        `INSERT INTO occupations (id, name, summary, scope, validation, source, sector, description, tasks, responsibilities,
           responsibility_level, is_synthetic, catalog_version)
         VALUES ($1, $2, $3, 'synthetic', 'demo', 'Catálogo sintético KALLPA', $4, $5, $6, $7, $8, true, $9)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, sector = EXCLUDED.sector,
           description = EXCLUDED.description, tasks = EXCLUDED.tasks, responsibilities = EXCLUDED.responsibilities,
           responsibility_level = EXCLUDED.responsibility_level, catalog_version = EXCLUDED.catalog_version, updated_at = now()
         WHERE occupations.is_synthetic`,
        [j.id, j.title, firstSentence(j.description), j.sector, j.description, j.tasks, j.responsibilities, j.level, CATALOG_VERSION],
      );
      for (const c of j.competencies) {
        await client.query(
          `INSERT INTO occupation_competencies (occupation_id, competency_id, weight) VALUES ($1, $2, $3)
           ON CONFLICT (occupation_id, competency_id) DO UPDATE SET weight = EXCLUDED.weight`,
          [j.id, c.id, c.weight],
        );
      }
      await client.query('DELETE FROM occupation_competencies WHERE occupation_id = $1 AND NOT (competency_id = ANY($2))', [j.id, j.competencies.map((c) => c.id)]);

      const keep = [];
      for (const r of j.requirements) {
        const { rows } = await client.query(
          `INSERT INTO occupation_requirements (occupation_id, kind, description, mandatory) VALUES ($1, $2, $3, $4)
           ON CONFLICT (occupation_id, kind, md5(description)) DO UPDATE SET mandatory = EXCLUDED.mandatory RETURNING id`,
          [j.id, r.kind, r.text, r.mandatory],
        );
        keep.push(rows[0].id);
      }
      await client.query('DELETE FROM occupation_requirements WHERE occupation_id = $1 AND NOT (id = ANY($2))', [j.id, keep]);
    }
    // Empleos sintéticos que ya no están en el archivo (sus competencias y requisitos caen en cascada).
    const { rowCount: removed } = await client.query('DELETE FROM occupations WHERE is_synthetic AND NOT (id = ANY($1))', [SYNTHETIC_JOBS.map((j) => j.id)]);
    await client.query('COMMIT');
    return { jobs: SYNTHETIC_JOBS.length, removed, version: CATALOG_VERSION };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Ejecución directa: `node server/catalog/load.js`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pool = createPool(process.env.DATABASE_URL);
  if (!pool) {
    console.error('Falta DATABASE_URL. Defínela en .env (ver .env.example).');
    process.exit(1);
  }
  try {
    const { migrate } = await import('../db/migrate.js');
    await migrate(pool, { log: (m) => console.log(m) });
    const r = await loadSyntheticCatalog(pool);
    console.log(`Catálogo ${r.version} cargado: ${r.jobs} empleos sintéticos${r.removed ? ` (${r.removed} obsoletos retirados)` : ''}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
