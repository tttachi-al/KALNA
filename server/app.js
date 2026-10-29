import { compareAll } from '../src/services/engine/matcher.js';
import { addExample } from '../src/services/engine/profile.js';
import { buildRoute } from '../src/services/engine/routeBuilder.js';
import { OCCUPATION_IDS } from '../src/data/occupations.js';
import { getTarget } from '../src/services/engine/targets.js';
import { ensureProfileId, isProfileId } from './db/profiles.js';
import { advanceAdaptiveDiagnosis, startAdaptiveDiagnosis } from './interview/flow.js';
import { SESSION_COOKIE } from './auth/service.js';

/**
 * Endpoints de KALLPA (contrato de src/services/adapters/qvacAdapter.js).
 *
 * - El diagnóstico usa la entrevista adaptativa con QVAC.
 * - Perfil, comparación, ruta y puestos reutilizan el motor local
 *   (misma respuesta que el modo `mock`), hasta que tengan su propia fase.
 * - Las sesiones (y la conversación) viven solo en memoria; nunca se guardan
 *   en PostgreSQL. Lo que sí se guarda es el PERFIL que resulta: competencias,
 *   estados, niveles y las citas que las respaldan (server/db/profiles.js).
 *   Se guarda cuando se genera el perfil (análisis de competencias), cuando
 *   termina el diagnóstico y cuando la persona agrega un ejemplo. Esas
 *   respuestas incluyen `persistence: { saved, profileId?, error? }`.
 * - Tras guardar un perfil, sus embeddings se generan en segundo plano
 *   (`embeddings.schedule`); la respuesta no los espera.
 */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_TEXT = 2000;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Respuesta con cookies (Set-Cookie). El servidor HTTP envía `body` como JSON. */
export class CookieResponse {
  constructor(body, cookies) {
    this.body = body;
    this.cookies = cookies;
  }
}

function sessionCookie(value, { expires = null, secure = false } = {}) {
  const parts = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  parts.push(expires ? `Expires=${expires.toUTCString()}` : 'Max-Age=0');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function createSessionStore() {
  const map = new Map();
  const sweep = () => {
    const now = Date.now();
    for (const [id, v] of map) if (now - v.touched > SESSION_TTL_MS) map.delete(id);
    while (map.size > MAX_SESSIONS) map.delete(map.keys().next().value);
  };
  return {
    get: (id) => map.get(id)?.session || null,
    set(session) {
      map.set(session.id, { session, touched: Date.now() });
      sweep();
    },
  };
}

/** Comprobación mínima de una sesión enviada por el navegador para retomarla. */
function looksLikeSession(s, id) {
  return (
    s && typeof s === 'object' && s.id === id && s.mode === 'adaptativo' && typeof s.stage === 'string' &&
    Array.isArray(s.messages) && s.profile && typeof s.profile === 'object' &&
    (s.stage !== 'entrevista' || (s.interview && Array.isArray(s.interview.dialog)))
  );
}

function cleanInput(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Falta la respuesta (input).');
  const text = typeof input.text === 'string' ? input.text.slice(0, MAX_TEXT) : undefined;
  const choices = Array.isArray(input.choices) ? input.choices.filter((c) => typeof c === 'string').slice(0, 10) : undefined;
  return { text, choices, skip: Boolean(input.skip) };
}

/**
 * @param {{ llm: object, db?: { query: Function }|null, profiles?: { save: Function, load: Function }|null,
 *          embeddings?: { schedule: Function, indexProfile: Function }|null, embedder?: { describe: Function }|null,
 *          recommender?: { recommend: Function, suggest: Function }|null,
 *          routes?: { build: Function, saveProgress: Function, list: Function }|null, log?: Function }} deps
 * @returns {(method: string, path: string, body: any, query?: URLSearchParams) => Promise<any>}
 */
export function createApp({ llm, db = null, profiles = null, embeddings = null, embedder = null, recommender = null, routes = null, passports = null, cvs = null, assessments = null, auth = null, secureCookies = false, log = () => {} }) {
  const sessions = createSessionStore();
  const busy = new Set();

  /** Guarda el perfil y devuelve el resultado real (nunca un éxito supuesto). */
  async function saveProfile(profile) {
    if (!profiles) return { saved: false, error: 'El servidor no tiene base de datos configurada (DATABASE_URL).' };
    try {
      await profiles.save(profile);
      // Sin esperar: un fallo queda registrado en profile_competencies.embedding_status.
      embeddings?.schedule(profile.profileId);
      return { saved: true, profileId: profile.profileId };
    } catch (error) {
      log(`No se pudo guardar el perfil ${profile.profileId?.slice(0, 8)}: ${error.message}`);
      return { saved: false, error: 'No se pudo guardar tu perfil en la base de datos.' };
    }
  }

  /** ¿Esta respuesta generó el perfil (análisis nuevo) o terminó el diagnóstico? */
  const profileChanged = (before, after) =>
    Boolean(after.profile.analysis?.at && after.profile.analysis.at !== before.profile.analysis?.at) || (after.stage === 'fin' && before.stage !== 'fin');

  async function answer(id, body) {
    let session = sessions.get(id);
    if (!session && looksLikeSession(body?.session, id)) {
      // El servidor se reinició o la sesión expiró: se retoma la copia del navegador.
      session = body.session;
      log(`Sesión ${id.slice(-6)} retomada desde el navegador`);
    }
    if (!session) throw new HttpError(404, 'No encontré esta conversación. Empieza el diagnóstico de nuevo.', { code: 'session_not_found' });
    if (busy.has(id)) throw new HttpError(409, 'Todavía estoy procesando tu respuesta anterior.', { retryable: true });
    busy.add(id);
    const t0 = Date.now();
    try {
      let r = await advanceAdaptiveDiagnosis(session, cleanInput(body?.input), { llm, semantic: recommender });
      let persistence;
      if (profileChanged(session, r.session)) {
        r = { ...r, session: { ...r.session, profile: ensureProfileId(r.session.profile) } };
        persistence = await saveProfile(r.session.profile);
      }
      sessions.set(r.session);
      const last = r.session.interview?.log?.at(-1);
      if (r.session.stage === 'entrevista' || session.stage === 'entrevista') {
        log(`Sesión ${id.slice(-6)} · turno ${r.session.interview?.turns ?? 0} · origen ${last?.origen ?? '-'} · ${Date.now() - t0} ms`);
      }
      return persistence ? { ...r, persistence } : r;
    } catch (error) {
      if (error.retryable) {
        // La sesión guardada no cambió: reintentar con la misma respuesta es seguro.
        throw new HttpError(503, error.message, { retryable: true, code: 'qvac_unavailable' });
      }
      throw error;
    } finally {
      busy.delete(id);
    }
  }

  async function loadProfile(id) {
    if (!profiles) throw new HttpError(503, 'El servidor no tiene base de datos configurada.', { code: 'db_disabled' });
    let p;
    try {
      p = await profiles.load(id);
    } catch (error) {
      log(`No se pudo leer el perfil ${id.slice(0, 8)}: ${error.message}`);
      throw new HttpError(503, 'No se pudo leer el perfil de la base de datos.', { retryable: true, code: 'db_unavailable' });
    }
    if (!p) throw new HttpError(404, 'No hay un perfil guardado con ese identificador.', { code: 'profile_not_found' });
    return p;
  }

  async function workProfile(id) {
    const stored = await loadProfile(id);
    return Array.isArray(stored.competencies) ? { ...stored,
      dismissed: stored.competencies.filter((c) => c.dismissed).map((c) => c.id),
      competencies: Object.fromEntries(stored.competencies.map((c) => [c.id, { ...c,
        mentions: (c.evidence || []).filter((e) => e.kind === 'mencion').map((e) => ({ quote: e.quote, source: e.source })),
        examples: (c.evidence || []).filter((e) => e.kind !== 'mencion').map((e) => ({ text: e.quote, level: e.quality })),
      }])),
    } : stored;
  }

  /** Reintento manual: genera (y espera) los embeddings pendientes de un perfil. */
  async function reindexProfile(id) {
    if (!embeddings) throw new HttpError(503, 'Los embeddings no están configurados en el servidor.', { code: 'embeddings_disabled' });
    const r = await embeddings.schedule(id);
    if (r.error === 'perfil_no_encontrado') throw new HttpError(404, 'No hay un perfil guardado con ese identificador.', { code: 'profile_not_found' });
    if (!r.ok) throw new HttpError(503, 'No se pudieron generar los embeddings. Puedes reintentar.', { retryable: true, code: 'embeddings_failed', detail: r.error });
    return r;
  }

  /**
   * Recomendaciones con los empleos SINTÉTICOS de PostgreSQL (búsqueda híbrida +
   * compatibilidad, server/matching/). Mismo contrato que antes (lista de
   * JobRecommendation) con `synthetic: true` y sin enlaces externos.
   */
  async function recommendJobsFromDb(body) {
    if (!recommender) throw new HttpError(503, 'Las recomendaciones necesitan PostgreSQL y el modelo de embeddings.', { code: 'recommendations_disabled' });
    const limit = Math.min(Math.max(Number(body?.limit) || 3, 1), 20);
    try {
      const { results, diagnostics } = await recommender.recommend(body?.profile, { limit });
      log(`Recomendaciones: ${results.length} de ${diagnostics.candidates?.total ?? 0} candidatos (${diagnostics.configVersion})`);
      return results;
    } catch (error) {
      log(`Recomendaciones: ${error.message}`);
      throw new HttpError(503, 'No se pudieron calcular las recomendaciones. Intenta de nuevo.', { retryable: true, code: 'recommendations_unavailable' });
    }
  }

  /** Guarda cambios del perfil hechos en la interfaz (por ejemplo, competencias descartadas). */
  async function saveProfileFromClient(body) {
    const profile = body?.profile;
    if (!profile || typeof profile !== 'object') throw new HttpError(400, 'Falta el perfil.');
    if (!isProfileId(profile.profileId)) return { ok: true, profile, persistence: { saved: false, error: 'El perfil todavía no se ha guardado en el servidor.' } };
    const persistence = await saveProfile(profile);
    return { ok: persistence.saved, profile, persistence };
  }

  /**
   * «Crear mi ruta» (server/route/): comparación con embeddings + reglas, ruta en
   * cuatro etapas y redacción con QVAC, guardada en PostgreSQL. Sin servicio de
   * rutas (sin base de datos), solo las cinco ocupaciones con el motor local.
   */
  async function buildRouteFor(body) {
    const occupationId = body?.occupationId;
    if (typeof occupationId !== 'string' || !/^[\w-]{1,80}$/.test(occupationId)) throw new HttpError(400, 'Falta el puesto de destino.');
    if (!routes) {
      if (!OCCUPATION_IDS.includes(occupationId)) throw new HttpError(503, 'Las rutas hacia este puesto necesitan PostgreSQL.', { code: 'routes_disabled' });
      return { ...buildRoute(body.profile, occupationId), persistence: { saved: false, reason: 'sin_base_de_datos' }, progress: {} };
    }
    try {
      return await routes.build(body?.profile || {}, occupationId);
    } catch (error) {
      if (error.status && error.status < 500) throw new HttpError(error.status, error.message, { code: error.code });
      log(`Ruta ${occupationId}: ${error.message}`);
      throw new HttpError(503, 'No se pudo crear tu ruta en este momento. Intenta de nuevo.', { retryable: true, code: 'route_unavailable' });
    }
  }

  async function saveRouteProgress(profileId, occupationId, body) {
    if (!routes) throw new HttpError(503, 'El progreso de la ruta necesita PostgreSQL.', { code: 'routes_disabled' });
    if (!body?.progress || typeof body.progress !== 'object') throw new HttpError(400, 'Falta el progreso.');
    try {
      return await routes.saveProgress(profileId, occupationId, body.progress);
    } catch (error) {
      if (error.status && error.status < 500) throw new HttpError(error.status, error.message, { code: error.code });
      log(`Progreso de ruta: ${error.message}`);
      throw new HttpError(503, 'No se pudo guardar tu avance. Intenta de nuevo.', { retryable: true });
    }
  }

  async function listRoutes(profileId) {
    if (!routes) return [];
    return routes.list(profileId);
  }

  /**
   * Evaluación de competencias (server/assessment/). El perfil se lee de
   * PostgreSQL cuando está guardado; si no, se usa el que envía el navegador y
   * el intento queda marcado como simulación.
   */
  async function handleAssessment(method, id, action, body) {
    if (!assessments) throw new HttpError(503, 'La evaluación de competencias no está disponible.', { code: 'assessments_disabled' });
    try {
      if (!id && method === 'POST') {
        const competencyIds = Array.isArray(body?.competencyIds) ? body.competencyIds.filter((c) => typeof c === 'string').slice(0, 20) : null;
        if (isProfileId(body?.profileId) && profiles) return await assessments.start({ profile: await workProfile(body.profileId), profileId: body.profileId, competencyIds });
        const profile = body?.profile;
        if (!profile || typeof profile.competencies !== 'object' || Object.keys(profile.competencies).length > 50) throw new HttpError(400, 'Falta el perfil para evaluar.');
        return await assessments.start({ profile, simulation: true, competencyIds });
      }
      if (method === 'GET' && !action) return await assessments.get(id);
      if (method === 'POST' && action === '/submit') return await assessments.submit(id, body?.answers);
      if (method === 'POST' && action === '/certificate') {
        const competencyId = typeof body?.competencyId === 'string' ? body.competencyId : null;
        return await assessments.certificate(id, { competencyId, participantName: typeof body?.participantName === 'string' ? body.participantName.slice(0, 120) : null, participantNameConfirmed: body?.participantNameConfirmed === true });
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.status) throw new HttpError(error.status, error.message, { code: error.code });
      log(`Evaluación: ${error?.message || error}`);
      throw new HttpError(503, action === '/certificate' ? 'No se pudo generar la constancia. Puedes reintentar.' : 'La evaluación no está disponible en este momento. Puedes reintentar.', { retryable: true, code: 'assessment_unavailable' });
    }
    throw new HttpError(404, 'Ruta no encontrada.');
  }

  /**
   * Cuentas (server/auth/). La sesión viaja en una cookie HttpOnly; la cuenta
   * a eliminar es siempre la de esa sesión, nunca un identificador del cuerpo.
   */
  async function handleAuth(route, body, ctx) {
    if (!auth) throw new HttpError(503, 'Las cuentas necesitan la base de datos de KALLPA (PostgreSQL).', { code: 'accounts_disabled' });
    const token = ctx.cookies?.[SESSION_COOKIE];
    const withSession = (result) => new CookieResponse({ user: result.user }, [sessionCookie(result.session.token, { expires: result.session.expires, secure: secureCookies })]);
    const cleared = (payload) => new CookieResponse(payload, [sessionCookie('', { secure: secureCookies })]);
    try {
      if (route === 'GET /auth/me') {
        const user = await auth.userFromToken(token);
        return user ? { user: await auth.describe(user) } : { user: null };
      }
      if (route === 'POST /auth/register') return withSession(await auth.register(body));
      if (route === 'POST /auth/login') return withSession(await auth.login(body));
      if (route === 'POST /auth/logout') {
        await auth.logout(token);
        return cleared({ ok: true });
      }
      if (route === 'DELETE /account') {
        const user = await auth.userFromToken(token);
        if (!user) throw new HttpError(401, 'Tu sesión expiró. Inicia sesión de nuevo para eliminar tu cuenta.', { code: 'not_authenticated' });
        return cleared(await auth.deleteAccount(user, body));
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.status) throw new HttpError(error.status, error.message, { code: error.code });
      log(`Cuentas (${route}): ${error?.message || error}`);
      throw new HttpError(503, route === 'DELETE /account' ? 'No se pudo eliminar la cuenta. No se borró ningún dato; inténtalo de nuevo.' : 'El servicio de cuentas no está disponible. Inténtalo de nuevo.', { retryable: true, code: 'accounts_unavailable' });
    }
    throw new HttpError(404, `Ruta no encontrada: ${route}`);
  }

  async function dbHealth() {
    if (!db) return { status: 'disabled' };
    try {
      await db.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return { status: 'error' };
    }
  }

  return async function handle(method, path, body, query = new URLSearchParams(), ctx = {}) {
    const route = `${method} ${path}`;
    let m;
    if (path.startsWith('/auth/') || route === 'DELETE /account') return handleAuth(route, body, ctx);
    if (route === 'GET /health') return { ok: true, llm: llm.describe(), embeddings: embedder?.describe() ?? null, db: await dbHealth() };
    if (route === 'POST /diagnosis/start') {
      const r = startAdaptiveDiagnosis();
      sessions.set(r.session);
      return r;
    }
    if (method === 'POST' && (m = path.match(/^\/diagnosis\/([\w-]{1,80})\/answer$/))) return answer(m[1], body);
    if (route === 'POST /profile/evidence') {
      if (!body?.profile || typeof body.competencyId !== 'string') throw new HttpError(400, 'Faltan el perfil o la competencia.');
      const r = addExample(body.profile, body.competencyId, String(body.text || '').slice(0, MAX_TEXT));
      // Solo los perfiles que ya se guardaron (tienen profileId) se actualizan en la base.
      return isProfileId(r.profile.profileId) ? { ...r, persistence: await saveProfile(r.profile) } : r;
    }
    if (method === 'GET' && (m = path.match(/^\/profile\/([0-9a-f-]{36})$/i))) return loadProfile(m[1]);
    if (method === 'POST' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/embeddings$/i))) return reindexProfile(m[1]);
    if (route === 'POST /occupations/compare') return compareAll(body?.profile);
    if (route === 'POST /passport') {
      if (!passports) throw new HttpError(503, 'El pasaporte necesita PostgreSQL y QVAC.');
      if (!isProfileId(body?.profileId) || typeof body?.occupationId !== 'string' || !/^[\w-]{1,80}$/.test(body.occupationId)) throw new HttpError(400, 'Faltan el perfil guardado y el puesto seleccionado.');
      const profile = await workProfile(body.profileId);
      try { return await passports.build(profile, body.occupationId); }
      catch (error) { throw new HttpError(error.status || 503, error.message, { code: error.code || 'passport_unavailable', retryable: true }); }
    }
    if (method === 'GET' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/passports\/([\w-]{1,80})$/i))) {
      if (!passports) throw new HttpError(503, 'El servicio de pasaportes no está disponible.');
      return passports.get(m[1], m[2]);
    }
    if (method === 'PUT' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/passports\/([\w-]{1,80})\/progress$/i))) {
      throw new HttpError(410, 'El progreso pertenece a tu ruta. El pasaporte presenta tu experiencia y competencias.');
    }
    if (route === 'POST /route') return buildRouteFor(body);
    if (route === 'POST /cv/word') {
      if (!cvs) throw new HttpError(503, 'La generación de Word no está disponible.');
      if (typeof body?.occupationId !== 'string' || !/^[\w-]{1,80}$/.test(body.occupationId)) throw new HttpError(400, 'Selecciona un puesto para generar el CV.');
      const simulation = body.mode === 'simulation';
      if (!simulation && !isProfileId(body.profileId)) throw new HttpError(400, 'Falta el perfil guardado.');
      const profile = simulation ? body.profile : await workProfile(body.profileId);
      if (!profile || !profile.competencies || typeof profile.competencies !== 'object' || Object.keys(profile.competencies).length > 50) throw new HttpError(400, 'El perfil no es válido.');
      let passport = body.passport;
      if (simulation) {
        const destination = getTarget(body.occupationId) || await routes?.loadDestination(body.occupationId);
        if (!destination || passport?.occupationId !== body.occupationId) throw new HttpError(400, 'El pasaporte no corresponde a un puesto disponible.');
        passport = { ...passport, target: destination };
      }
      try { return await cvs.generate({ profile, occupationId: body.occupationId, simulation, passport, draft: body.draft }); }
      catch (error) { log(`CV no generado (${body.occupationId}): ${error?.message || error}`); throw new HttpError(error.status || 503, error.status ? error.message : 'No se pudo generar el CV en Word. Puedes reintentar.', { code: error.code || 'cv_unavailable', retryable: true }); }
    }
    if (method === 'GET' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/cv$/i))) {
      if (!cvs?.store) throw new HttpError(503, 'El almacenamiento de CV no está disponible.');
      await loadProfile(m[1]);
      return cvs.store.load(m[1]);
    }
    if (method === 'PUT' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/cv$/i))) {
      if (!cvs?.store) throw new HttpError(503, 'El almacenamiento de CV no está disponible.');
      await loadProfile(m[1]);
      if (body?.targetOccupationId != null && (typeof body.targetOccupationId !== 'string' || !/^[\w-]{1,80}$/.test(body.targetOccupationId))) throw new HttpError(400, 'El puesto del CV no es válido.');
      try { return await cvs.store.save(m[1], body?.cv, body?.targetOccupationId || null); }
      catch (error) { throw new HttpError(error.status || 503, error.status ? error.message : 'No se pudo guardar el CV.'); }
    }
    if (route === 'POST /assessments') return handleAssessment(method, null, '', body);
    if ((m = path.match(/^\/assessments\/([0-9a-f-]{36})(\/submit|\/certificate)?$/i))) return handleAssessment(method, m[1], m[2] || '', body);
    if (method === 'PUT' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/routes\/([\w-]{1,80})\/progress$/i))) return saveRouteProgress(m[1], m[2], body);
    if (method === 'GET' && (m = path.match(/^\/profile\/([0-9a-f-]{36})\/routes$/i))) return listRoutes(m[1]);
    if (route === 'POST /jobs/recommend') return recommendJobsFromDb(body);
    if (method === 'GET' && (m = path.match(/^\/demand\/([\w-]+)$/))) {
      // Sin fuente oficial de demanda regional: no se afirma nada.
      return { available: false, occupationId: m[1], region: query.get('region') || null, source: null, updatedAt: null };
    }
    if (route === 'PUT /profile') return saveProfileFromClient(body);
    throw new HttpError(404, `Ruta no encontrada: ${route}`);
  };
}
