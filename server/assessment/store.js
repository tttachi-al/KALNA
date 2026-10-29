/**
 * Almacenamiento de intentos de evaluación.
 * - Con PostgreSQL: tabla competency_assessments (migración 012).
 * - Sin base de datos: memoria del servidor, hasta 24 h o hasta que se reinicie.
 *   La interfaz lo indica (`persistent: false`).
 */
export function createAssessmentDbStore(pool) {
  return {
    persistent: true,
    async save(attempt) {
      await pool.query(`INSERT INTO competency_assessments (id, profile_id, status, data) VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data = EXCLUDED.data, updated_at = now()`, [attempt.id, attempt.profileId || null, attempt.status, attempt]);
      return attempt;
    },
    async get(id) {
      const { rows: [row] } = await pool.query('SELECT data FROM competency_assessments WHERE id = $1', [id]);
      return row?.data || null;
    },
  };
}

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_MAX = 500;

export function createAssessmentMemoryStore() {
  const map = new Map();
  return {
    persistent: false,
    async save(attempt) {
      map.delete(attempt.id);
      map.set(attempt.id, { attempt: structuredClone(attempt), at: Date.now() });
      for (const [id, v] of map) if (Date.now() - v.at > MEMORY_TTL_MS) map.delete(id);
      while (map.size > MEMORY_MAX) map.delete(map.keys().next().value);
      return attempt;
    },
    async get(id) {
      const v = map.get(id);
      return v && Date.now() - v.at <= MEMORY_TTL_MS ? structuredClone(v.attempt) : null;
    },
  };
}
