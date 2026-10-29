import { evidenceText, hashInput, INPUT_FORMATS } from '../embeddings/texts.js';

/**
 * Recuperación semántica con PostgreSQL + pgvector.
 *
 * Todas las consultas filtran por el MISMO modelo y versión del embedder y
 * comparan consultas (evidencias, formato `retrieval_query`) con documentos
 * (referencias y tareas, formato `retrieval_document`). Los resultados son
 * similitudes coseno: sirven para proponer candidatos, nunca son un
 * porcentaje de compatibilidad.
 */
const DOC = INPUT_FORMATS.documento.id;
const QUERY = INPUT_FORMATS.consulta.id;
const toPgVector = (v) => `[${v.join(',')}]`;

export function createSemanticIndex({ pool, embedder }) {
  let centroidCache = null;

  async function modelKey() {
    if (embedder.describe().status !== 'ready') await embedder.load();
    const d = embedder.describe();
    return { model: d.model, version: d.modelVersion };
  }

  /**
   * Vectores de varias citas: reutiliza los guardados en evidence_embeddings
   * (mismo modelo, versión, formato y texto) y genera en memoria los que falten.
   * @returns {Promise<{ text: string, vector: number[] }[]>} en el mismo orden (las vacías se omiten)
   */
  async function embedEvidence(quotes) {
    const { model, version } = await modelKey();
    const items = quotes.map((q) => evidenceText(q)).filter(Boolean).map((t) => ({ ...t, hash: hashInput(model, t.format, t.input) }));
    if (!items.length) return [];
    const { rows } = await pool.query(
      'SELECT DISTINCT ON (text_hash) text_hash, embedding::text AS v FROM evidence_embeddings WHERE text_hash = ANY($1) AND model = $2 AND model_version IS NOT DISTINCT FROM $3 AND input_format = $4',
      [items.map((i) => i.hash), model, version, QUERY],
    );
    const stored = new Map(rows.map((r) => [r.text_hash, JSON.parse(r.v)]));
    const missing = items.filter((i) => !stored.has(i.hash));
    if (missing.length) {
      const r = await embedder.embed(missing.map((i) => i.input));
      missing.forEach((i, k) => stored.set(i.hash, r.vectors[k]));
    }
    return items.map((i) => ({ text: i.text, vector: stored.get(i.hash) }));
  }

  /** Similitud de una evidencia con cada competencia (máxima entre sus referencias). */
  async function competencyScores(vector) {
    const { model, version } = await modelKey();
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (competency_id) competency_id, text_kind, text, 1 - (embedding <=> $1::vector) AS sim
       FROM competency_embeddings
       WHERE model = $2 AND model_version IS NOT DISTINCT FROM $3 AND input_format = $4
       ORDER BY competency_id, embedding <=> $1::vector`,
      [toPgVector(vector), model, version, DOC],
    );
    return rows.map((r) => ({ competencyId: r.competency_id, similarity: Number(r.sim), reference: { kind: r.text_kind, text: r.text } })).sort((a, b) => b.similarity - a.similarity);
  }

  /** Empleos sintéticos cuya TAREA más parecida a la evidencia supera `minSimilarity`. */
  async function taskMatches(vector, { minSimilarity, limit = 15 }) {
    const { model, version } = await modelKey();
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (oe.occupation_id) oe.occupation_id, oe.text AS task, 1 - (oe.embedding <=> $1::vector) AS sim
         FROM occupation_embeddings oe JOIN occupations o ON o.id = oe.occupation_id AND o.is_synthetic
         WHERE oe.text_kind = 'tareas' AND oe.model = $2 AND oe.model_version IS NOT DISTINCT FROM $3 AND oe.input_format = $4
         ORDER BY oe.occupation_id, oe.embedding <=> $1::vector
       ) t WHERE sim >= $5 ORDER BY sim DESC LIMIT $6`,
      [toPgVector(vector), model, version, DOC, minSimilarity, limit],
    );
    return rows.map((r) => ({ occupationId: r.occupation_id, task: r.task, similarity: Number(r.sim) }));
  }

  /**
   * Similitud de una evidencia con la DESCRIPCIÓN GENERAL de los empleos indicados.
   * Sin umbral: sus valores absolutos se solapan con los de frases sin relación,
   * así que solo sirve para ORDENAR candidatos ya recuperados por otra vía.
   */
  async function descriptionScores(vector, occupationIds) {
    if (!occupationIds.length) return new Map();
    const { model, version } = await modelKey();
    const { rows } = await pool.query(
      `SELECT occupation_id, 1 - (embedding <=> $1::vector) AS sim FROM occupation_embeddings
       WHERE text_kind = 'descripcion' AND model = $2 AND model_version IS NOT DISTINCT FROM $3 AND input_format = $4 AND occupation_id = ANY($5)`,
      [toPgVector(vector), model, version, DOC, occupationIds],
    );
    return new Map(rows.map((r) => [r.occupation_id, Number(r.sim)]));
  }

  /**
   * Similitud entre competencias: coseno entre los centroides de sus
   * referencias (pgvector `avg`). Se calcula una vez y se guarda en memoria.
   * @returns {Promise<Map<string, Map<string, number>>>}
   */
  async function competencySimilarity() {
    if (centroidCache) return centroidCache;
    const { model, version } = await modelKey();
    const { rows } = await pool.query(
      `WITH c AS (
         SELECT competency_id, avg(embedding) AS v FROM competency_embeddings
         WHERE model = $1 AND model_version IS NOT DISTINCT FROM $2 AND input_format = $3 GROUP BY competency_id)
       SELECT a.competency_id AS a, b.competency_id AS b, 1 - (a.v <=> b.v) AS sim FROM c a CROSS JOIN c b WHERE a.competency_id <> b.competency_id`,
      [model, version, DOC],
    );
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.a)) m.set(r.a, new Map());
      m.get(r.a).set(r.b, Number(r.sim));
    }
    centroidCache = m;
    return m;
  }

  return { embedEvidence, competencyScores, taskMatches, descriptionScores, competencySimilarity, modelKey, resetCache: () => (centroidCache = null) };
}
