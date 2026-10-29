import { createHash } from 'node:crypto';
import { OCCUPATIONS } from '../../src/data/occupations.js';
import { MATCHING_CONFIG } from '../matching/config.js';
import { ROUTE_PROMPT_VERSION, personalizeRoute } from './personalize.js';
import { buildRoutePlan, ROUTE_RULES_VERSION } from './plan.js';

/**
 * «Crear mi ruta»: destino (PostgreSQL o catálogo de referencia) + perfil →
 * comparación (embeddings + reglas, server/matching/) → ruta (reglas, plan.js)
 * → redacción con QVAC (personalize.js) → guardado en employability_routes
 * (tabla existente, migración 009; la huella va en `route.fingerprint`).
 *
 * - El destino SIEMPRE se carga en el servidor a partir del id pedido: la ruta
 *   no puede quedar asociada a otro puesto.
 * - Si el perfil (competencias, citas, descartes) y el destino no cambiaron,
 *   se reutiliza la ruta guardada sin volver a llamar al modelo.
 * - El progreso se guarda por actividad (ids estables).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEMORY_LIMIT = 200;

export class RouteError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Preguntas de entrevista a partir de las tareas reales del puesto (sin inventar). */
const interviewFromTasks = (tasks) => tasks.slice(0, 3).map((t) => `¿Cómo lo haces o lo harías?: ${t.charAt(0).toLowerCase()}${t.slice(1)}. Cuéntalo con un ejemplo.`);

export function createRouteService({ pool = null, recommender, llm = null, log = () => {} }) {
  const memory = new Map();
  // Generaciones en curso por huella: dos peticiones iguales a la vez comparten una sola.
  const inFlight = new Map();

  /** Destino: empleo sintético de PostgreSQL o una de las cinco ocupaciones de referencia. */
  async function loadDestination(id) {
    const occ = OCCUPATIONS[id];
    if (occ) {
      return {
        id,
        name: occ.name,
        sector: null,
        summary: occ.summary,
        synthetic: false,
        requires: occ.requires,
        requirements: occ.requirements.map((text) => ({ kind: 'condicion', text, mandatory: false })),
        interview: occ.interview,
      };
    }
    if (!pool) return null;
    const { rows: [job] } = await pool.query('SELECT id, name, sector, summary, tasks FROM occupations WHERE id = $1 AND is_synthetic', [id]);
    if (!job) return null;
    const { rows: comps } = await pool.query('SELECT competency_id, weight FROM occupation_competencies WHERE occupation_id = $1 ORDER BY weight, competency_id', [id]);
    const { rows: reqs } = await pool.query('SELECT kind, description, mandatory FROM occupation_requirements WHERE occupation_id = $1 ORDER BY id', [id]);
    return {
      id,
      name: job.name,
      sector: job.sector,
      summary: job.summary,
      synthetic: true,
      requires: comps.map((c) => ({ id: c.competency_id, weight: c.weight })),
      requirements: reqs.map((r) => ({ kind: r.kind, text: r.description, mandatory: r.mandatory })),
      interview: interviewFromTasks(job.tasks || []),
    };
  }

  /** Huella de lo que define la ruta: si no cambia, la ruta se reutiliza. */
  function fingerprint(profile, destination) {
    const dismissed = new Set(profile?.dismissed || []);
    const comps = Object.values(profile?.competencies || {})
      .filter((c) => !dismissed.has(c.id))
      .map((c) => [c.id, c.status, c.level, c.levelReason, (c.mentions || []).map((m) => m.quote), (c.examples || []).map((e) => [e.text, e.level])])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const key = JSON.stringify([ROUTE_RULES_VERSION, ROUTE_PROMPT_VERSION, MATCHING_CONFIG.version, destination, comps, [...dismissed].sort(), profile?.experience || null]);
    return createHash('sha256').update(key).digest('hex');
  }

  async function stored(profileId, occupationId) {
    if (!pool || !UUID.test(profileId || '')) return null;
    const { rows: [r] } = await pool.query('SELECT route, progress, updated_at FROM employability_routes WHERE profile_id = $1 AND occupation_id = $2', [profileId, occupationId]);
    return r ? { ...r, fingerprint: r.route?.fingerprint || null } : null;
  }

  async function profileExists(profileId) {
    if (!pool || !UUID.test(profileId || '')) return false;
    const { rows } = await pool.query('SELECT 1 FROM job_profiles WHERE id = $1', [profileId]);
    return rows.length > 0;
  }

  /**
   * @returns {Promise<object>} ruta + `persistence` + `progress`
   */
  async function build(profile, occupationId) {
    const destination = await loadDestination(occupationId);
    if (!destination) throw new RouteError(404, 'Ese puesto no está en el catálogo de KALLPA.', 'occupation_not_found');
    const fp = fingerprint(profile, destination);
    const profileId = profile?.profileId;
    const prev = await stored(profileId, occupationId).catch((e) => {
      log(`Ruta: no se pudo leer la ruta guardada: ${e.message}`);
      return null;
    });

    let route;
    if (prev?.fingerprint === fp) route = prev.route;
    else if (memory.get(fp)) route = memory.get(fp);
    else {
      if (!inFlight.has(fp)) {
        const job = (async () => {
          const { result } = await recommender.compare(profile, destination);
          const plan = buildRoutePlan({ destination, evaluation: result });
          const t0 = Date.now();
          const { route: written, personalization } = await personalizeRoute({ route: plan, profile, llm });
          const r = { ...written, fingerprint: fp, personalization: { ...personalization, ms: Date.now() - t0 } };
          log(`Ruta ${occupationId}: ${r.total} actividades · redacción ${personalization.engine}${personalization.ok ? ` (${personalization.accepted} aceptadas)` : ` (${personalization.reason || 'rechazada'})`}`);
          memory.set(fp, r);
          if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
          return r;
        })().finally(() => inFlight.delete(fp));
        inFlight.set(fp, job);
      }
      route = await inFlight.get(fp);
    }
    if (route.occupationId !== occupationId) throw new RouteError(500, 'La ruta no corresponde al puesto pedido.', 'route_mismatch');

    // Guardado en PostgreSQL (solo perfiles ya guardados). El progreso anterior se conserva.
    const validIds = new Set(route.stages.flatMap((s) => s.items.map((i) => i.id)));
    const progress = Object.fromEntries(Object.entries(prev?.progress || {}).filter(([k, v]) => v && validIds.has(k)));
    let persistence = { saved: false, reason: 'perfil_no_guardado' };
    if (await profileExists(profileId).catch(() => false)) {
      try {
        await pool.query(
          `INSERT INTO employability_routes (profile_id, occupation_id, route, progress) VALUES ($1, $2, $3, $4)
           ON CONFLICT (profile_id, occupation_id) DO UPDATE SET route = EXCLUDED.route, progress = EXCLUDED.progress, updated_at = now()`,
          [profileId, occupationId, route, progress],
        );
        persistence = { saved: true };
      } catch (error) {
        log(`Ruta: no se pudo guardar: ${error.message}`);
        persistence = { saved: false, error: 'No se pudo guardar la ruta en la base de datos.' };
      }
    }
    return { ...route, persistence, progress };
  }

  /** Guarda el progreso (solo ids de actividades de la ruta guardada). */
  async function saveProgress(profileId, occupationId, progress) {
    const prev = await stored(profileId, occupationId);
    if (!prev) throw new RouteError(404, 'No hay una ruta guardada para ese puesto. Ábrela de nuevo.', 'route_not_found');
    const valid = new Set(prev.route.stages.flatMap((s) => s.items.map((i) => i.id)));
    const clean = Object.fromEntries(Object.entries(progress || {}).filter(([k, v]) => v === true && valid.has(k)));
    const { rows: [r] } = await pool.query(
      'UPDATE employability_routes SET progress = $3, updated_at = now() WHERE profile_id = $1 AND occupation_id = $2 RETURNING progress, updated_at',
      [profileId, occupationId, clean],
    );
    return { progress: r.progress, updatedAt: r.updated_at.toISOString() };
  }

  /** Rutas guardadas de un perfil con su avance. */
  async function list(profileId) {
    if (!pool || !UUID.test(profileId || '')) return [];
    const { rows } = await pool.query('SELECT occupation_id, route, progress, updated_at FROM employability_routes WHERE profile_id = $1 ORDER BY updated_at DESC', [profileId]);
    return rows.map((r) => ({
      occupationId: r.occupation_id,
      name: r.route.target?.name,
      done: Object.values(r.progress).filter(Boolean).length,
      total: r.route.total,
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  return { build, saveProgress, list, loadDestination, async get(profileId, occupationId) {
    const prev = await stored(profileId, occupationId);
    return prev ? { ...prev.route, progress: prev.progress, persistence: { saved: true } } : null;
  } };
}
