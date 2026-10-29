import { COMPETENCIES } from '../../src/data/competencies.js';
import { evaluateJob, rankResults } from './compatibility.js';
import { MATCHING_CONFIG } from './config.js';

/**
 * Recomendación de empleos sintéticos (PostgreSQL) en dos pasos separados:
 *
 *  1. RECUPERACIÓN híbrida de candidatos
 *     a. directa:      empleos que requieren una competencia del perfil
 *     b. transferible: empleos que requieren una competencia para la que el
 *                      perfil tiene una base (`bases`) o una competencia
 *                      semánticamente cercana (≥ umbral calibrado)
 *     c. semántica:    empleos con alguna TAREA parecida a una evidencia de la
 *                      persona (pgvector, ≥ umbral calibrado)
 *  2. COMPATIBILIDAD explicable de cada candidato (compatibility.js).
 *
 * Las competencias descartadas por la persona no se usan. Sin competencias
 * válidas no se recomienda nada.
 */
export function createRecommender({ pool, semantic, config = MATCHING_CONFIG }) {
  /** Competencias NO descartadas del perfil, con sus citas. */
  function ownCompetencies(profile) {
    const dismissed = new Set(profile?.dismissed || []);
    const own = new Map();
    for (const c of Object.values(profile?.competencies || {})) {
      if (!COMPETENCIES[c.id] || dismissed.has(c.id) || !['evidencia', 'declarada', 'por_validar'].includes(c.status)) continue;
      const quotes = [
        ...(c.examples || []).filter((e) => e.level === 'fuerte').map((e) => e.text),
        ...(c.mentions || []).map((m) => m.quote),
        ...(c.examples || []).filter((e) => e.level !== 'fuerte').map((e) => e.text),
      ].filter((q, i, a) => q && a.indexOf(q) === i);
      own.set(c.id, { status: c.status, quotes });
    }
    return { own, dismissed };
  }

  async function loadJobs() {
    const { rows: jobs } = await pool.query('SELECT id, name, sector, summary FROM occupations WHERE is_synthetic ORDER BY id');
    const { rows: comps } = await pool.query(
      'SELECT oc.occupation_id, oc.competency_id, oc.weight FROM occupation_competencies oc JOIN occupations o ON o.id = oc.occupation_id WHERE o.is_synthetic',
    );
    const { rows: reqs } = await pool.query(
      'SELECT r.occupation_id, r.kind, r.description, r.mandatory FROM occupation_requirements r JOIN occupations o ON o.id = r.occupation_id WHERE o.is_synthetic ORDER BY r.id',
    );
    return new Map(
      jobs.map((j) => [
        j.id,
        {
          ...j,
          requires: comps.filter((c) => c.occupation_id === j.id).map((c) => ({ id: c.competency_id, weight: c.weight })),
          requirements: reqs.filter((r) => r.occupation_id === j.id).map((r) => ({ kind: r.kind, text: r.description, mandatory: r.mandatory })),
        },
      ]),
    );
  }

  /**
   * Preparación común (recomendación y ruta): competencias propias, similitud
   * entre competencias, vectores de las evidencias y competencias «posibles».
   * Si los embeddings no están disponibles, sigue sin la parte semántica.
   */
  async function context(profile) {
    const { own, dismissed } = ownCompetencies(profile);
    const diagnostics = { configVersion: config.version, competencies: own.size, dismissed: [...dismissed], candidates: {}, model: null };
    let sims = new Map();
    let vectors = [];
    if (own.size) {
      try {
        sims = await semantic.competencySimilarity();
        diagnostics.model = await semantic.modelKey();
        // Evidencias de la persona (solo de competencias no descartadas).
        const quotes = [...new Set([...own.values()].flatMap((c) => c.quotes))].slice(0, 30);
        vectors = await semantic.embedEvidence(quotes);
        diagnostics.semantic = true;
      } catch (error) {
        diagnostics.semantic = false;
        diagnostics.semanticError = error?.message || String(error);
      }
    }
    const similarity = (a, b) => sims.get(a)?.get(b);
    // «Posible»: una evidencia se parece, sobre todo, a una competencia que el perfil no tiene.
    const possible = new Map();
    for (const v of vectors) {
      const [top] = await semantic.competencyScores(v.vector);
      if (!top || top.similarity < config.semantic.possible) continue;
      if (own.has(top.competencyId) || dismissed.has(top.competencyId)) continue;
      const prev = possible.get(top.competencyId);
      if (!prev || top.similarity > prev.similarity) possible.set(top.competencyId, { quote: v.text, similarity: top.similarity });
    }
    return { own, dismissed, similarity, vectors, possible, diagnostics };
  }

  /**
   * Compatibilidad con UN destino (la usa la ruta): misma lógica que la
   * recomendación. `job` = { id, name, sector, summary, requires, requirements }.
   */
  async function compare(profile, job) {
    const ctx = await context(profile);
    const tasks = [];
    for (const v of ctx.vectors) {
      for (const t of await semantic.taskMatches(v.vector, { minSimilarity: config.semantic.task, limit: 60 })) {
        if (t.occupationId === job.id) tasks.push({ task: t.task, quote: v.text, similarity: t.similarity });
      }
    }
    const result = evaluateJob({ job, own: ctx.own, similarity: ctx.similarity, possible: ctx.possible, tasks, config });
    return { result, own: ctx.own, dismissed: ctx.dismissed, diagnostics: ctx.diagnostics };
  }

  /**
   * @returns {Promise<{ results: object[], diagnostics: object }>}
   */
  async function recommend(profile, { limit = config.maxResults } = {}) {
    const { own, similarity, vectors, possible, diagnostics } = await context(profile);
    if (!own.size) return { results: [], diagnostics: { ...diagnostics, reason: 'sin_competencias' } };
    const jobs = await loadJobs();

    // c. Tareas parecidas a las evidencias.
    const tasksByJob = new Map();
    for (const v of vectors) {
      for (const t of await semantic.taskMatches(v.vector, { minSimilarity: config.semantic.task, limit: config.semantic.tasksPerEvidence })) {
        if (!tasksByJob.has(t.occupationId)) tasksByJob.set(t.occupationId, []);
        tasksByJob.get(t.occupationId).push({ task: t.task, quote: v.text, similarity: t.similarity });
      }
    }

    // a + b. Competencias directas y transferibles.
    const candidates = new Set(tasksByJob.keys());
    let direct = 0;
    let transfer = 0;
    for (const job of jobs.values()) {
      const reqIds = job.requires.map((r) => r.id);
      if (reqIds.some((r) => own.has(r))) {
        candidates.add(job.id);
        direct += 1;
      } else if (reqIds.some((r) => [...own.keys()].some((p) => COMPETENCIES[r].bases.some((b) => b.id === p) || (similarity(p, r) ?? 0) >= config.semantic.transfer))) {
        candidates.add(job.id);
        transfer += 1;
      }
    }
    diagnostics.candidates = { total: candidates.size, porCompetencia: direct, porTransferencia: transfer, porTareas: tasksByJob.size };

    const evaluated = [...candidates].map((id) => evaluateJob({ job: jobs.get(id), own, similarity, possible, tasks: tasksByJob.get(id) || [], config }));

    // Orden dentro de cada banda: parecido entre las evidencias y la DESCRIPCIÓN del
    // empleo, normalizado entre los candidatos (0 = el menos parecido, 1 = el más).
    // No crea candidatos ni cambia cobertura ni banda.
    if (vectors.length && semantic.descriptionScores && evaluated.length > 1) {
      const best = new Map();
      for (const v of vectors) {
        for (const [id, s] of await semantic.descriptionScores(v.vector, [...candidates])) best.set(id, Math.max(best.get(id) ?? -1, s));
      }
      const values = [...best.values()];
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      for (const r of evaluated) {
        const s = best.get(r.jobId);
        r.descriptionRelevance = s == null || hi <= lo ? 0 : Math.round(((s - lo) / (hi - lo)) * 1000) / 1000;
      }
    }
    const results = rankResults(evaluated, config).slice(0, limit);
    return { results, diagnostics };
  }

  /**
   * Candidatas para el análisis de competencias: para cada cita, las
   * competencias del catálogo más parecidas (≥ umbral y cerca de la mejor).
   * Es una PISTA para QVAC; la validación en código decide.
   */
  async function suggest(texts, { dismissed = [] } = {}) {
    const skip = new Set(dismissed);
    const vectors = await semantic.embedEvidence(texts);
    const out = [];
    for (const v of vectors) {
      const scores = await semantic.competencyScores(v.vector);
      const top = scores[0]?.similarity ?? 0;
      const ids = scores
        .filter((s) => s.similarity >= config.semantic.candidate && s.similarity >= top - config.semantic.candidateMargin && !skip.has(s.competencyId))
        .slice(0, 3)
        .map((s) => ({ id: s.competencyId, similarity: Math.round(s.similarity * 1000) / 1000 }));
      if (ids.length) out.push({ quote: v.text, candidates: ids });
    }
    return out;
  }

  return { recommend, suggest, compare, loadJobs };
}
