/**
 * Adaptador de DEMOSTRACIÓN (modo 'mock').
 *
 * Ejecuta todo en el navegador con el motor de reglas de
 * src/services/engine. No envía datos a ningún servidor.
 *
 * Implementa el mismo contrato que qvacAdapter.js.
 */
import { MOCK_LATENCY } from '../config.js';
import { advance, describeStage, startSession } from '../engine/diagnosisFlow.js';
import { recommendJobs } from '../engine/jobMatcher.js';
import { compareAll } from '../engine/matcher.js';
import { addExample } from '../engine/profile.js';
import { buildRoute } from '../engine/routeBuilder.js';
import { qvacAdapter } from './qvacAdapter.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const mockAdapter = {
  name: 'mock',
  // Word always uses the backend. An unavailable model produces an actual error.
  generateCvWord: (body) => qvacAdapter.generateCvWord(body),
  // La evaluación también usa siempre el backend: el navegador no debe tener las claves ni corregir.
  startAssessment: (body) => qvacAdapter.startAssessment(body),
  // Las cuentas viven en el backend: sin servidor no hay inicio de sesión.
  getAccount: () => qvacAdapter.getAccount(),
  register: (body) => qvacAdapter.register(body),
  login: (body) => qvacAdapter.login(body),
  logout: () => qvacAdapter.logout(),
  deleteAccount: (body) => qvacAdapter.deleteAccount(body),
  getAssessment: (id) => qvacAdapter.getAssessment(id),
  submitAssessment: (id, answers) => qvacAdapter.submitAssessment(id, answers),
  downloadAssessmentCertificate: (id, body) => qvacAdapter.downloadAssessmentCertificate(id, body),
  async createPassport() { throw new Error('El pasaporte personalizado requiere el backend y modelos QVAC disponibles.'); },
  async getPassport() { return null; },

  async startDiagnosis() {
    const session = startSession();
    return { session, messages: session.messages, ui: describeStage(session) };
  },

  async sendDiagnosisAnswer(session, input) {
    await wait(MOCK_LATENCY.chat);
    const { session: next, messages } = advance(session, input);
    return { session: next, messages, ui: describeStage(next) };
  },

  describeStage(session) {
    return describeStage(session);
  },

  async addEvidence(profile, competencyId, text) {
    await wait(MOCK_LATENCY.query);
    return addExample(profile, competencyId, text);
  },

  async compareOccupations(profile) {
    return compareAll(profile);
  },

  async buildRoute(profile, occupationId) {
    const route = buildRoute(profile, occupationId);
    return route && { ...route, persistence: { saved: false, reason: 'modo_local' } };
  },

  // Sin backend, la ruta y el CV solo se guardan en este navegador (estado de la app).
  async saveRouteProgress(profileId, occupationId, progress) {
    return { progress, local: true };
  },

  async listRoutes() {
    return [];
  },

  async loadCv() {
    return { data: null, targetOccupationId: null, updatedAt: null };
  },

  async saveCv(profileId, cv, targetOccupationId) {
    return { data: cv, targetOccupationId, updatedAt: null, local: true };
  },

  /** Puestos recomendados para postular (catálogo local); enlazan a Empleos Perú. */
  async recommendJobs(profile, limit = 3) {
    return recommendJobs(profile, limit);
  },

  /**
   * Demanda laboral regional: AÚN NO DISPONIBLE.
   * KALLPA no afirma que una ocupación tenga alta demanda sin datos que lo respalden.
   */
  async getRegionalDemand(occupationId, region = null) {
    return { available: false, occupationId, region, source: null, updatedAt: null };
  },

  async saveProfile(profile) {
    // En modo demostración el perfil solo se guarda en este navegador (localStorage).
    return { ok: true, profile };
  },
};
