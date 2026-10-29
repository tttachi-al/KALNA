/**
 * ════════════════════════════════════════════════════════════════════
 *  ADAPTADOR QVAC  —  ESTE ES EL ARCHIVO QUE DEBES COMPLETAR
 *  PARA CONECTAR EL BACKEND Y QVAC.
 * ════════════════════════════════════════════════════════════════════
 *
 * Cómo activarlo:
 *   1. Copia `.env.example` como `.env`.
 *   2. Cambia `VITE_KALLPA_MODE=qvac` y define `VITE_KALLPA_API_URL`.
 *   3. Implementa en tu backend los endpoints descritos abajo (el backend
 *      es quien llama a QVAC; el navegador nunca debe tener credenciales).
 *   4. Reinicia `npm run dev`.
 *
 * Este adaptador debe cumplir EXACTAMENTE el mismo contrato que
 * `mockAdapter.js`. Así, ninguna pantalla de React necesita cambios.
 *
 * Contrato de datos (resumen):
 *
 *   Session  = { id, stage, messages: Message[], profile: Profile, done: boolean, ... }
 *   Message  = { id, role: 'bot'|'user', text, kind, data? }
 *   StageUI  = { stage, progress, input, choices[], multi, suggestions[],
 *                allowSkip, skipLabel, placeholder, hint, actions[] }
 *   Profile  = { alias, experience: { occupations[], formality, duration },
 *                answers, competencies: { [id]: Competency }, dismissed[],
 *                target, routeProgress }
 *   Competency = { id, status: 'evidencia'|'declarada'|'por_validar',
 *                  mentions: [{ quote, source }], examples: [{ text, level, at }] }
 *
 * Reglas que QVAC debe respetar (alcance del proyecto):
 *   - Solo cinco ocupaciones: limpieza, administrativo, reponedor, vendedor, cajero.
 *   - Solo competencias del catálogo `src/data/competencies.js` (o su versión oficial).
 *   - Nunca asumir una competencia por el solo hecho de haber trabajado en una ocupación.
 *   - No afirmar demanda laboral sin datos verificables.
 */
import { API_URL } from '../config.js';
import { describeStage as describeLocally } from '../engine/diagnosisFlow.js';

const BINARY_KINDS = {
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', signature: [0x50, 0x4b], label: 'un archivo Word', fallback: 'CV_Mi_Perfil.docx' },
  pdf: { mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46], label: 'un archivo PDF', fallback: 'Constancia_KALLPA.pdf' },
};

async function request(path, { method = 'GET', body, binary = false, timeoutMs } = {}) {
  let response;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller && setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // cookie de sesión de la cuenta (HttpOnly)
      body: body ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } catch {
    clearTimeout(timer);
    if (controller?.signal.aborted) throw new Error('El servidor tardó demasiado en responder. Puede estar ocupado con otra solicitud; vuelve a intentarlo en unos segundos.');
    throw new Error('No se pudo conectar con el servidor de KALLPA. Revisa VITE_KALLPA_API_URL o vuelve al modo demostración.');
  }
  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = '';
    try {
      message = JSON.parse(detail).error || '';
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(message || `El servidor respondió ${response.status}. ${detail}`.trim());
  }
  if (binary) {
    const kind = BINARY_KINDS[binary === true ? 'docx' : binary];
    if (!response.headers.get('Content-Type')?.includes(kind.mime)) throw new Error(`El servidor no devolvió ${kind.label} válido.`);
    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, kind.signature.length).arrayBuffer());
    if (blob.size < 500 || kind.signature.some((b, i) => signature[i] !== b)) throw new Error(`${kind.label[0].toUpperCase()}${kind.label.slice(1)} está vacío o no es válido.`);
    const filename = response.headers.get('Content-Disposition')?.match(/filename="([a-zA-Z0-9_.-]+)"/)?.[1] || kind.fallback;
    return { blob, filename };
  }
  return response.json();
}

export const qvacAdapter = {
  name: 'qvac',
  generateCvWord: (body) => request('/cv/word', { method: 'POST', body, binary: 'docx', timeoutMs: 5 * 60 * 1000 }),

  /**
   * Evaluación de competencias (server/assessment/). La corrección y las claves
   * viven en el backend; las preguntas se preparan en segundo plano.
   *   POST /assessments  body: { profileId } | { profile }, competencyIds? → intento (status 'preparando')
   *   GET  /assessments/:id → intento (items sin clave; results al completar)
   *   POST /assessments/:id/submit  body: { answers: { [itemId]: optionId } } → intento corregido
   *   POST /assessments/:id/certificate  body: { competencyId?, participantName?, participantNameConfirmed? } → PDF
   */
  startAssessment: (body) => request('/assessments', { method: 'POST', body, timeoutMs: 60 * 1000 }).catch((error) => {
    // Un backend anterior a la evaluación responde 404 «Ruta no encontrada».
    if (/Ruta no encontrada/.test(error.message)) throw new Error('El servidor de Kalna todavía no tiene la evaluación de competencias. Reinicia el backend (npm run server) y vuelve a intentarlo.');
    throw error;
  }),
  getAssessment: (id) => request(`/assessments/${encodeURIComponent(id)}`, { timeoutMs: 30 * 1000 }),
  submitAssessment: (id, answers) => request(`/assessments/${encodeURIComponent(id)}/submit`, { method: 'POST', body: { answers }, timeoutMs: 60 * 1000 }),
  downloadAssessmentCertificate: (id, body) => request(`/assessments/${encodeURIComponent(id)}/certificate`, { method: 'POST', body, binary: 'pdf', timeoutMs: 60 * 1000 }),
  createPassport: (profileId, occupationId) => request('/passport', { method: 'POST', body: { profileId, occupationId } }),
  getPassport: (profileId, occupationId) => request(`/profile/${encodeURIComponent(profileId)}/passports/${encodeURIComponent(occupationId)}`),

  /**
   * Cuentas (server/auth/). La sesión es una cookie HttpOnly que el navegador envía sola.
   *   GET  /auth/me → { user: { email, createdAt, profileIds } | null }
   *   POST /auth/register | /auth/login  body: { email, password, profileId? } → { user }
   *   POST /auth/logout → { ok }
   *   DELETE /account  body: { password, confirmation: 'ELIMINAR' } → { deleted, removed }
   */
  getAccount: () => request('/auth/me', { timeoutMs: 15 * 1000 }),
  register: (body) => request('/auth/register', { method: 'POST', body, timeoutMs: 30 * 1000 }),
  login: (body) => request('/auth/login', { method: 'POST', body, timeoutMs: 30 * 1000 }),
  logout: () => request('/auth/logout', { method: 'POST', timeoutMs: 15 * 1000 }),
  deleteAccount: (body) => request('/account', { method: 'DELETE', body, timeoutMs: 60 * 1000 }),

  /** POST /diagnosis/start → { session, messages, ui } */
  async startDiagnosis() {
    return request('/diagnosis/start', { method: 'POST' });
  },

  /**
   * POST /diagnosis/:sessionId/answer
   * body: { input: { text?, choices?, skip? }, session? }
   * → { session, messages, ui }
   *
   * El backend (server/) usa QVAC para decidir la siguiente pregunta de la
   * entrevista adaptativa. `session` es opcional: permite retomar la
   * conversación si el servidor se reinició. Si QVAC falla, responde 503 y la
   * sesión no cambia, así que «Reintentar» envía la misma respuesta.
   */
  async sendDiagnosisAnswer(session, input) {
    return request(`/diagnosis/${encodeURIComponent(session.id)}/answer`, { method: 'POST', body: { input, session } });
  },

  /** Si el servidor no envía `ui`, se reconstruye localmente a partir de la etapa. */
  describeStage(session) {
    return session.ui || describeLocally(session);
  },

  /** POST /profile/evidence  body: { profile, competencyId, text } → { profile, level } */
  async addEvidence(profile, competencyId, text) {
    return request('/profile/evidence', { method: 'POST', body: { profile, competencyId, text } });
  },

  /** POST /occupations/compare  body: { profile } → Comparison[] (las cinco ocupaciones) */
  async compareOccupations(profile) {
    return request('/occupations/compare', { method: 'POST', body: { profile } });
  },

  /**
   * POST /route  body: { profile, occupationId }
   * → Route + `persistence: { saved, … }` y `progress` si el perfil ya está en PostgreSQL.
   */
  async buildRoute(profile, occupationId) {
    return request('/route', { method: 'POST', body: { profile, occupationId } });
  },

  /**
   * POST /jobs/recommend  body: { profile, limit }
   * → JobRecommendation[] con los empleos SINTÉTICOS de PostgreSQL (server/matching/):
   *   mismo formato base que engine/jobMatcher.js más `synthetic: true`, `band`,
   *   `pendingRequirements`, `possible`, `taskEvidence` y `reasons`. Sin `url`:
   *   no son ofertas publicadas.
   */
  async recommendJobs(profile, limit = 3) {
    return request('/jobs/recommend', { method: 'POST', body: { profile, limit } });
  },

  /**
   * GET /demand/:occupationId?region=…
   * → { available: boolean, occupationId, region, source, updatedAt, ... }
   * Conecta aquí datos de demanda laboral regional cuando estén disponibles.
   */
  async getRegionalDemand(occupationId, region = null) {
    const q = region ? `?region=${encodeURIComponent(region)}` : '';
    return request(`/demand/${encodeURIComponent(occupationId)}${q}`);
  },

  /** PUT /profile/:id/routes/:occupationId/progress  body: { progress } → { progress, updatedAt } */
  async saveRouteProgress(profileId, occupationId, progress) {
    return request(`/profile/${encodeURIComponent(profileId)}/routes/${encodeURIComponent(occupationId)}/progress`, { method: 'PUT', body: { progress } });
  },

  /** GET /profile/:id/routes → [{ occupationId, name, done, total, updatedAt }] */
  async listRoutes(profileId) {
    return request(`/profile/${encodeURIComponent(profileId)}/routes`);
  },

  /** GET /profile/:id/cv → { data|null, targetOccupationId, updatedAt } */
  async loadCv(profileId) {
    return request(`/profile/${encodeURIComponent(profileId)}/cv`);
  },

  /** PUT /profile/:id/cv  body: { cv, targetOccupationId } → { data, targetOccupationId, updatedAt } (400 si no es válido) */
  async saveCv(profileId, cv, targetOccupationId) {
    return request(`/profile/${encodeURIComponent(profileId)}/cv`, { method: 'PUT', body: { cv, targetOccupationId } });
  },

  /** PUT /profile  body: { profile } → { ok, profile } */
  async saveProfile(profile) {
    return request('/profile', { method: 'PUT', body: { profile } });
  },
};
