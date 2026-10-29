/**
 * Punto ÚNICO de acceso a datos para toda la interfaz.
 *
 * Las pantallas de React solo importan `kallpaService`. Según
 * VITE_KALLPA_MODE se usa el adaptador de demostración o el de QVAC.
 *
 * Para conectar el backend y QVAC: completa `adapters/qvacAdapter.js`.
 */
import { KALLPA_MODE } from './config.js';
import { mockAdapter } from './adapters/mockAdapter.js';
import { qvacAdapter } from './adapters/qvacAdapter.js';
import { advance, describeStage, startSession } from './engine/diagnosisFlow.js';
import { DEMO_CASE } from '../data/demoCase.js';
import { buildDemoPassport } from './engine/demoPassport.js';

const adapter = KALLPA_MODE === 'qvac' ? qvacAdapter : mockAdapter;

export const kallpaService = {
  mode: adapter.name,
  generateCvWord: (body) => adapter.generateCvWord(body),
  getAccount: () => adapter.getAccount(),
  register: (body) => adapter.register(body),
  login: (body) => adapter.login(body),
  logout: () => adapter.logout(),
  deleteAccount: (body) => adapter.deleteAccount(body),
  startAssessment: (body) => adapter.startAssessment(body),
  getAssessment: (id) => adapter.getAssessment(id),
  submitAssessment: (id, answers) => adapter.submitAssessment(id, answers),
  downloadAssessmentCertificate: (id, body) => adapter.downloadAssessmentCertificate(id, body),
  createDemoPassport: (profile, occupationId, target) => buildDemoPassport(profile, occupationId, target),
  createPassport: (profileId, occupationId) => adapter.createPassport(profileId, occupationId),
  getPassport: (profileId, occupationId) => adapter.getPassport(profileId, occupationId),
  startDiagnosis: () => adapter.startDiagnosis(),
  sendDiagnosisAnswer: (session, input) => adapter.sendDiagnosisAnswer(session, input),
  describeStage: (session) => adapter.describeStage(session),
  addEvidence: (profile, competencyId, text) => adapter.addEvidence(profile, competencyId, text),
  compareOccupations: (profile) => adapter.compareOccupations(profile),
  buildRoute: (profile, occupationId) => adapter.buildRoute(profile, occupationId),
  recommendJobs: (profile, limit) => adapter.recommendJobs(profile, limit),
  getRegionalDemand: (occupationId, region) => adapter.getRegionalDemand(occupationId, region),
  saveProfile: (profile) => adapter.saveProfile(profile),
  saveRouteProgress: (profileId, occupationId, progress) => adapter.saveRouteProgress(profileId, occupationId, progress),
  listRoutes: (profileId) => adapter.listRoutes(profileId),
  loadCv: (profileId) => adapter.loadCv(profileId),
  saveCv: (profileId, cv, targetOccupationId) => adapter.saveCv(profileId, cv, targetOccupationId),
};

/**
 * Construye el caso de demostración (María, ficticia) ejecutando el MISMO
 * motor de diagnóstico con respuestas guionadas. Siempre es local: el modo
 * demostración no depende del backend.
 *
 * @returns {{ transcript: object[], checkpoints: Record<string, number>, session: object }}
 */
export function buildDemoCase() {
  let session = startSession();
  const transcript = [...session.messages];
  const checkpoints = {};
  const send = (input) => {
    const r = advance(session, input);
    // Los mensajes de la persona se agregan a la sesión dentro de advance();
    // aquí reconstruimos la transcripción completa en orden.
    const added = r.session.messages.slice(session.messages.length);
    transcript.push(...added);
    session = r.session;
  };

  send({ choices: ['empezar'] });
  for (const stage of ['nombre', 'ocupaciones', 'formalidad', 'tiempo', 'tareas', 'herramientas', 'responsabilidades', 'situaciones']) {
    if (stage === 'tareas') checkpoints.relato = transcript.length;
    const ans = DEMO_CASE.answers[stage];
    send(ans);
  }
  checkpoints.evidencias = transcript.length;
  let guard = 0;
  while (session.stage === 'evidencia' && guard < 10) {
    const id = session.queue[session.queueIndex];
    const text = DEMO_CASE.evidence[id];
    send(text ? { text } : { skip: true });
    guard += 1;
  }
  checkpoints.fin = transcript.length;

  const profile = { ...session.profile, target: DEMO_CASE.target, routeProgress: {} };
  return { transcript, checkpoints, session: { ...session, profile }, ui: describeStage(session), profile };
}
