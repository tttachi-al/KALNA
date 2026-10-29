import { COMPETENCIES } from '../../src/data/competencies.js';
import { COMPETENCY_REFERENCES, REFERENCES_VERSION } from '../catalog/competency-references.js';
import { catalogReferenceTexts, evidenceText, hashInput, INPUT_FORMATS, occupationTexts } from './texts.js';

/**
 * Genera y guarda embeddings en PostgreSQL (pgvector), siempre con el modelo
 * del embedder (mismo modelo, versión y dimensión para todo lo que se compara):
 *
 *  - Catálogo:  competency_embeddings — descripción + indicadores + ejemplos
 *               de cada competencia (formato documento). Las comparten todos
 *               los empleos que requieren la competencia: no se duplican.
 *  - Empleos:   occupation_embeddings — vector general + uno por tarea de cada
 *               empleo sintético guardado en PostgreSQL (formato documento).
 *  - Evidencias: evidence_embeddings — un vector por cita de la persona
 *               (formato consulta). Nunca la conversación.
 *
 * Idempotente: solo se embebe lo que no existe o cambió (hash de modelo +
 * formato + texto); los vectores sobrantes del mismo modelo se retiran. El
 * estado `generado` de una competencia se escribe en la misma transacción que
 * sus vectores; si algo falla queda `error` con el motivo y se reintenta.
 *
 * Los trabajos de perfiles van en cola y fuera de la respuesta HTTP.
 * (`profile_competency_embeddings`, de la versión anterior, ya no se escribe.)
 */
const toPgVector = (v) => `[${v.join(',')}]`;
const DOC = INPUT_FORMATS.documento.id;
const QUERY = INPUT_FORMATS.consulta.id;

export function createEmbeddingIndexer({ pool, embedder, profiles, log = () => {} }) {
  let chain = Promise.resolve();
  const model = () => embedder.describe().model;

  /** Inserta/actualiza filas de una tabla de vectores con clave (id, kind, chunk). */
  async function upsertDocVectors({ table, idColumn, items, extra = {} }) {
    const m = model();
    for (const it of items) it.hash = hashInput(m, it.format, it.input);
    const { rows } = await pool.query(`SELECT ${idColumn} AS id, text_kind, chunk, text_hash FROM ${table} WHERE model = $1 AND input_format = $2`, [m, DOC]);
    const key = (id, kind, chunk) => `${id}|${kind}|${chunk}`;
    const current = new Map(rows.map((r) => [key(r.id, r.text_kind, r.chunk), r.text_hash]));
    const wanted = new Set(items.map((it) => key(it.id, it.textKind, it.chunk)));
    const todo = items.filter((it) => current.get(key(it.id, it.textKind, it.chunk)) !== it.hash);
    const stale = rows.filter((r) => !wanted.has(key(r.id, r.text_kind, r.chunk)));
    if (!todo.length && !stale.length) return { embedded: 0, unchanged: items.length, removed: 0 };

    const result = todo.length ? await embedder.embed(todo.map((it) => it.input)) : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cols = Object.keys(extra);
      for (const [i, it] of todo.entries()) {
        await client.query(
          `INSERT INTO ${table} (${idColumn}, text_kind, chunk, text, text_hash, model, model_version, input_format, dim, embedding${cols.map((c) => `, ${c}`).join('')})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector${cols.map((_, k) => `, $${11 + k}`).join('')})
           ON CONFLICT (${idColumn}, text_kind, chunk, model, input_format) DO UPDATE SET text = EXCLUDED.text,
             text_hash = EXCLUDED.text_hash, model_version = EXCLUDED.model_version, dim = EXCLUDED.dim,
             embedding = EXCLUDED.embedding, created_at = now()${cols.map((c) => `, ${c} = EXCLUDED.${c}`).join('')}`,
          [it.id, it.textKind, it.chunk, it.text, it.hash, model(), result.modelVersion, it.format, result.dim, toPgVector(result.vectors[i]), ...cols.map((c) => extra[c])],
        );
      }
      // Vectores derivados que ya no corresponden a ningún texto (mismo modelo y formato).
      for (const r of stale) {
        await client.query(`DELETE FROM ${table} WHERE ${idColumn} = $1 AND text_kind = $2 AND chunk = $3 AND model = $4 AND input_format = $5`, [r.id, r.text_kind, r.chunk, model(), DOC]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return { embedded: todo.length, unchanged: items.length - todo.length, removed: stale.length, dim: result?.dim };
  }

  /** Referencias de las 20 competencias (descripción, indicadores y ejemplos). */
  async function indexCatalog() {
    const items = Object.keys(COMPETENCIES)
      .flatMap((id) => catalogReferenceTexts(id, COMPETENCY_REFERENCES))
      .map((it) => ({ ...it, id: it.competencyId }));
    return upsertDocVectors({ table: 'competency_embeddings', idColumn: 'competency_id', items, extra: { reference_version: REFERENCES_VERSION } });
  }

  /** Empleos sintéticos guardados en PostgreSQL: vector general + uno por tarea. */
  async function indexOccupations() {
    const { rows } = await pool.query('SELECT id, name, description, tasks, responsibilities FROM occupations WHERE is_synthetic ORDER BY id');
    const items = rows.flatMap((j) => occupationTexts(j)).map((it) => ({ ...it, id: it.occupationId }));
    const r = await upsertDocVectors({ table: 'occupation_embeddings', idColumn: 'occupation_id', items });
    return { ...r, occupations: rows.length };
  }

  async function markError(profileId, ids, message) {
    if (!ids.length) return;
    try {
      await pool.query(
        "UPDATE profile_competencies SET embedding_status = 'error', embedding_error = $3, embedding_updated_at = now() WHERE profile_id = $1 AND competency_id = ANY($2)",
        [profileId, ids, message.slice(0, 500)],
      );
    } catch (error) {
      log(`No se pudo registrar el error de embeddings del perfil ${profileId.slice(0, 8)}: ${error.message}`);
    }
  }

  /**
   * Un vector por evidencia de las competencias NO descartadas del perfil.
   * @returns {Promise<{ ok: boolean, embedded: number, unchanged: number, dim?: number, error?: string }>}
   */
  async function indexProfile(profileId) {
    const p = await profiles.load(profileId);
    if (!p) return { ok: false, embedded: 0, unchanged: 0, error: 'perfil_no_encontrado' };
    const m = model();
    const { rows: evidence } = await pool.query(
      `SELECT e.id, e.competency_id, e.quote, ee.text_hash
       FROM competency_evidence e
       JOIN profile_competencies pc ON pc.profile_id = e.profile_id AND pc.competency_id = e.competency_id
       LEFT JOIN evidence_embeddings ee ON ee.evidence_id = e.id AND ee.model = $2 AND ee.input_format = $3
       WHERE e.profile_id = $1 AND NOT pc.dismissed`,
      [profileId, m, QUERY],
    );
    const items = evidence
      .map((e) => ({ ...e, t: evidenceText(e.quote) }))
      .filter((e) => e.t)
      .map((e) => ({ ...e, hash: hashInput(m, e.t.format, e.t.input) }));
    const todo = items.filter((e) => e.text_hash !== e.hash);
    const competencies = [...new Set(p.competencies.filter((c) => !c.dismissed).map((c) => c.id))];
    const touched = [...new Set(todo.map((e) => e.competency_id))];

    if (!todo.length) {
      await pool.query(
        "UPDATE profile_competencies SET embedding_status = 'generado', embedding_error = NULL, embedding_updated_at = now() WHERE profile_id = $1 AND competency_id = ANY($2) AND embedding_status <> 'generado'",
        [profileId, competencies],
      );
      return { ok: true, embedded: 0, unchanged: items.length };
    }

    let result;
    try {
      result = await embedder.embed(todo.map((e) => e.t.input));
    } catch (error) {
      const message = `Generación: ${error.message}`;
      log(`Embeddings del perfil ${profileId.slice(0, 8)} sin generar: ${error.message}`);
      await markError(profileId, touched, message);
      return { ok: false, embedded: 0, unchanged: items.length - todo.length, error: message };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [i, e] of todo.entries()) {
        await client.query(
          `INSERT INTO evidence_embeddings (evidence_id, model, model_version, input_format, text, text_hash, dim, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
           ON CONFLICT (evidence_id, model, input_format) DO UPDATE SET model_version = EXCLUDED.model_version,
             text = EXCLUDED.text, text_hash = EXCLUDED.text_hash, dim = EXCLUDED.dim, embedding = EXCLUDED.embedding, created_at = now()`,
          [e.id, m, result.modelVersion, e.t.format, e.t.text, e.hash, result.dim, toPgVector(result.vectors[i])],
        );
      }
      await client.query(
        "UPDATE profile_competencies SET embedding_status = 'generado', embedding_error = NULL, embedding_updated_at = now() WHERE profile_id = $1 AND competency_id = ANY($2)",
        [profileId, competencies],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      const message = `Almacenamiento: ${error.message}`;
      log(`Embeddings del perfil ${profileId.slice(0, 8)} sin guardar: ${error.message}`);
      await markError(profileId, touched, message);
      return { ok: false, embedded: 0, unchanged: items.length - todo.length, error: message };
    } finally {
      client.release();
    }
    log(`Embeddings del perfil ${profileId.slice(0, 8)}: ${todo.length} evidencias, ${items.length - todo.length} sin cambios`);
    return { ok: true, embedded: todo.length, unchanged: items.length - todo.length, dim: result.dim };
  }

  /** Encola la indexación de un perfil (no lanza; devuelve el resultado). */
  function schedule(profileId) {
    const job = chain.then(() => indexProfile(profileId)).catch((error) => {
      log(`Embeddings del perfil ${profileId.slice(0, 8)}: ${error.message}`);
      return { ok: false, embedded: 0, unchanged: 0, error: error.message };
    });
    chain = job;
    return job;
  }

  /**
   * Reintenta los perfiles con competencias pendientes o con error, o con
   * evidencias sin vector del modelo ACTUAL.
   * @param {{ limit?: number, profileIds?: string[]|null }} o  `profileIds` limita a esos perfiles
   */
  async function retryPending({ limit = 50, profileIds = null } = {}) {
    const { rows } = await pool.query(
      `SELECT DISTINCT pc.profile_id FROM profile_competencies pc
       LEFT JOIN competency_evidence e ON e.profile_id = pc.profile_id AND e.competency_id = pc.competency_id
       LEFT JOIN evidence_embeddings ee ON ee.evidence_id = e.id AND ee.model = $1 AND ee.input_format = $2
       WHERE NOT pc.dismissed AND (pc.embedding_status <> 'generado' OR (e.id IS NOT NULL AND ee.evidence_id IS NULL))
         AND ($3::uuid[] IS NULL OR pc.profile_id = ANY($3::uuid[]))
       LIMIT $4`,
      [model(), QUERY, profileIds, limit],
    );
    return Promise.all(rows.map((r) => schedule(r.profile_id)));
  }

  return { indexCatalog, indexOccupations, indexProfile, schedule, retryPending, idle: () => chain };
}
