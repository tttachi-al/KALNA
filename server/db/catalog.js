import { COMPETENCIES, FAMILIES, FAMILY_ORDER } from '../../src/data/competencies.js';

const SOURCE = 'src/data/competencies.js';

/**
 * Copia el catálogo de competencias del código a PostgreSQL (upsert).
 * Las competencias de un perfil referencian estas filas. Los datos son de
 * demostración (`validation = 'demo'`). No borra filas que ya no estén en el
 * código.
 */
export async function syncCatalog(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of Object.values(FAMILIES)) {
      await client.query(
        `INSERT INTO competency_families (id, name, short, ord) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, short = EXCLUDED.short, ord = EXCLUDED.ord`,
        [f.id, f.name, f.short, FAMILY_ORDER.indexOf(f.id)],
      );
    }
    for (const c of Object.values(COMPETENCIES)) {
      await client.query(
        `INSERT INTO competencies (id, family_id, name, short, description, validation, source) VALUES ($1, $2, $3, $4, $5, 'demo', $6)
         ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id, name = EXCLUDED.name, short = EXCLUDED.short,
           description = EXCLUDED.description, source = EXCLUDED.source, updated_at = now()
         WHERE (competencies.family_id, competencies.name, competencies.short, competencies.description)
           IS DISTINCT FROM (EXCLUDED.family_id, EXCLUDED.name, EXCLUDED.short, EXCLUDED.description)`,
        [c.id, c.family, c.name, c.short, c.description, SOURCE],
      );
    }
    await client.query('COMMIT');
    return { families: Object.keys(FAMILIES).length, competencies: Object.keys(COMPETENCIES).length };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
