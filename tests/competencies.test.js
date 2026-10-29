// Identificación de competencias con un modelo SIMULADO (`scriptedLlm`).
//
// Validan la lógica de KALLPA (validación, estados, reintento, recuperación,
// cuándo se ejecuta el análisis y qué se guarda). NO prueban la calidad de
// QVAC: las salidas del "modelo" están escritas a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COMPETENCIES } from '../src/data/competencies.js';
import { createApp } from '../server/app.js';
import { ANALYSIS_PROMPT, buildAnalysisHistory, runCompetencyAnalysis } from '../server/competencies/analyze.js';
import { applyAnalysis } from '../server/competencies/merge.js';
import { ANALYSIS_FORMAT, ANALYSIS_SCHEMA } from '../server/competencies/schema.js';
import { parseAnalysis, validateAnalysis } from '../server/competencies/validate.js';
import { advanceAdaptiveDiagnosis, startAdaptiveDiagnosis } from '../server/interview/flow.js';
import { LlmUnavailableError } from '../server/qvac/llm.js';
import { createEmptyProfile } from '../src/services/engine/profile.js';
import { BASICS, notes, ques, scriptedLlm } from './helpers/conversation.js';

/* ───────── Utilidades ───────── */

const ANSWERS = [
  'Repongo los anaqueles de abarrotes cada mañana y reviso las fechas de vencimiento.',
  'El lunes encontré yogures vencidos, los retiré del anaquel y avisé al supervisor.',
];
const interviewOf = (answers = ANSWERS) => ({
  dialog: answers.flatMap((a, i) => [{ role: 'assistant', content: `Pregunta ${i + 1}: ¿qué haces en tu trabajo?` }, { role: 'user', content: a }]),
  log: [],
});
const comp = (id, status, evidence, extra = {}) => ({ id, status, evidence, level: 'sin_nivel', level_reason: '', ...extra });
const ev = (quote, type) => ({ quote, type });
const out = (competencies, missing = []) => JSON.stringify({ competencies, missing_information: missing });

const GOOD = out(
  [
    comp('control_existencias', 'evidencia', [ev('El lunes encontré yogures vencidos, los retiré del anaquel y avisé al supervisor', 'ejemplo_concreto')], {
      level: 'intermedio',
      level_reason: 'Detectó solo productos vencidos y avisó.',
    }),
    comp('reposicion', 'declarada', [ev('Repongo los anaqueles de abarrotes cada mañana', 'afirmacion')]),
  ],
  ['Cómo registra lo que retira del anaquel'],
);

/** Respuestas del modelo para llegar a la entrevista, responder dos veces y terminar. */
const TO_INTERVIEW = [ques('¿Cómo aprendiste lo que haces hoy?', { area: 'antes' }), notes(), ques('¿Qué pasó la última vez?'), notes(), ques('¿Y después?')];
const isAnalysis = (c) => c.responseFormat === ANALYSIS_FORMAT;

function tracked(outputs) {
  const llm = scriptedLlm(outputs);
  const calls = [];
  const generate = llm.generate;
  llm.generate = (p) => {
    calls.push(p);
    return generate(p);
  };
  llm.calls = calls;
  return llm;
}

async function playToClose(llm) {
  let r = startAdaptiveDiagnosis();
  for (const input of BASICS) r = await advanceAdaptiveDiagnosis(r.session, input, { llm });
  for (const text of ANSWERS) r = await advanceAdaptiveDiagnosis(r.session, { text }, { llm });
  const beforeClose = r;
  r = await advanceAdaptiveDiagnosis(r.session, { skip: true }, { llm });
  return { beforeClose, closed: r };
}

/* ───────── Esquema y prompt ───────── */

test('el esquema limita los ids al catálogo y se envía como json_schema', () => {
  assert.equal(ANALYSIS_FORMAT.type, 'json_schema');
  assert.deepEqual(ANALYSIS_SCHEMA.properties.competencies.items.properties.id.enum, Object.keys(COMPETENCIES));
  assert.deepEqual(ANALYSIS_SCHEMA.required, ['competencies', 'missing_information']);
  assert.ok(ANALYSIS_PROMPT.includes('control_existencias:'), 'el prompt incluye el catálogo');
  assert.ok(!ANALYSIS_PROMPT.includes('{{CATALOGO}}'));
});

test('el análisis recibe la entrevista de la sesión como contexto', () => {
  const h = buildAnalysisHistory({ interview: interviewOf(), profile: createEmptyProfile() });
  assert.equal(h[0].role, 'system');
  assert.ok(h[1].content.includes(`Persona: ${ANSWERS[1]}`));
  assert.ok(h[1].content.includes('Entrevistador: Pregunta 1'));
});

/* ───────── Validación en código ───────── */

const validate = (competencies, profile = {}) => validateAnalysis({ competencies, missing_information: [] }, ANSWERS, profile);

test('acepta citas literales y completa nombre y descripción desde el catálogo', () => {
  const v = validateAnalysis(JSON.parse(GOOD), ANSWERS, {});
  assert.deepEqual(v.competencies.map((c) => [c.id, c.status, c.level]), [['control_existencias', 'evidencia', 'intermedio'], ['reposicion', 'declarada', null]]);
  assert.equal(v.competencies[0].name, COMPETENCIES.control_existencias.name);
  assert.equal(v.competencies[0].description, COMPETENCIES.control_existencias.description);
  assert.deepEqual(v.missingInformation, ['Cómo registra lo que retira del anaquel']);
});

test('descarta citas inventadas, citas del entrevistador y competencias sin cita válida', () => {
  const v = validate([
    comp('atencion_cliente', 'declarada', [ev('atiendo a los clientes con amabilidad', 'afirmacion')]),
    comp('comunicacion', 'declarada', [ev('qué haces en tu trabajo', 'afirmacion')]),
  ]);
  assert.deepEqual(v.competencies, []);
  assert.ok(v.rejected.some((r) => r.id === 'atencion_cliente' && r.why === 'cita_no_literal'));
  assert.ok(v.rejected.some((r) => r.id === 'comunicacion' && r.why === 'cita_no_literal'));
});

test('nombrar la ocupación no es una competencia', () => {
  const v = validateAnalysis({ competencies: [comp('reposicion', 'declarada', [ev('soy reponedor', 'afirmacion')])], missing_information: [] }, ['Soy reponedor en un mercado.'], {});
  assert.deepEqual(v.competencies, []);
  assert.ok(v.rejected.some((r) => r.why === 'cita_solo_ocupacion'));
});

test('«evidencia» sin hecho concreto baja a «declarada»; solo indicios quedan «por validar»', () => {
  const v = validate([
    comp('reposicion', 'evidencia', [ev('Repongo los anaqueles de abarrotes cada mañana', 'ejemplo_concreto')]),
    comp('control_existencias', 'declarada', [ev('reviso las fechas de vencimiento', 'indicio')]),
  ]);
  assert.deepEqual(v.competencies.map((c) => [c.id, c.status]), [['reposicion', 'declarada'], ['control_existencias', 'por_validar']]);
  assert.equal(v.competencies[0].evidence[0].type, 'afirmacion', 'la etiqueta de la cita también se corrige');
});

test('lo que falta saber se limpia de puntuación final y se limita a cinco', () => {
  const v = validateAnalysis({ competencies: [], missing_information: ['Cómo cuadra la caja.', 'Cómo cuadra la caja.', 'a;', 'b', 'c', 'd', 'e'] }, ANSWERS, {});
  assert.deepEqual(v.missingInformation, ['Cómo cuadra la caja', 'a', 'b', 'c', 'd']);
});

test('el código nunca sube el estado que propuso el modelo', () => {
  const v = validate([comp('control_existencias', 'por_validar', [ev('El lunes encontré yogures vencidos', 'ejemplo_concreto')])]);
  assert.equal(v.competencies[0].status, 'por_validar');
});

test('el nivel solo se conserva con evidencia y justificación; si no, es null', () => {
  const v = validate([
    comp('reposicion', 'declarada', [ev('Repongo los anaqueles de abarrotes cada mañana', 'afirmacion')], { level: 'avanzado', level_reason: 'Lo hace a diario.' }),
    comp('control_existencias', 'evidencia', [ev('El lunes encontré yogures vencidos', 'ejemplo_concreto')], { level: 'intermedio', level_reason: '' }),
  ]);
  assert.deepEqual(v.competencies.map((c) => c.level), [null, null]);
  assert.equal(v.rejected.filter((r) => r.why === 'nivel_sin_respaldo').length, 2);
});

test('respeta lo que la persona descartó y no admite ids fuera del catálogo', () => {
  const v = validate(
    [comp('reposicion', 'declarada', [ev('Repongo los anaqueles de abarrotes cada mañana', 'afirmacion')]), comp('liderazgo', 'declarada', [ev('avisé al supervisor', 'afirmacion')])],
    { dismissed: ['reposicion'] },
  );
  assert.deepEqual(v.competencies, []);
  assert.deepEqual(v.rejected.map((r) => r.why), ['descartada_por_la_persona', 'fuera_del_catalogo']);
});

test('una misma cita no respalda más de tres competencias', () => {
  const q = [ev('Repongo los anaqueles de abarrotes cada mañana', 'afirmacion')];
  const v = validate(['reposicion', 'org_productos', 'control_existencias', 'recepcion_mercaderia'].map((id) => comp(id, 'declarada', q)));
  assert.equal(v.competencies.length, 3);
  assert.ok(v.rejected.some((r) => r.why === 'cita_sobreinterpretada'));
});

test('parseAnalysis rechaza JSON inválido o incompleto', () => {
  assert.equal(parseAnalysis('').error, 'respuesta_vacia');
  assert.equal(parseAnalysis('{"competencies": [').error, 'json_invalido');
  assert.equal(parseAnalysis('{"competencies": []}').error, 'falta_missing_information');
  assert.equal(parseAnalysis('Aquí está: {"competencies": [], "missing_information": []}').ok, true);
});

/* ───────── Reintento y recuperación ───────── */

test('JSON inválido: reintenta una vez con la corrección y usa la segunda respuesta', async () => {
  const llm = tracked(['{"competencies": [', GOOD]);
  const a = await runCompetencyAnalysis({ interview: interviewOf(), profile: createEmptyProfile(), llm });
  assert.equal(a.ok, true);
  assert.equal(llm.calls.length, 2);
  assert.match(llm.calls[1].history.at(-1).content, /json_invalido/);
  assert.equal(a.competencies.length, 2);
});

test('JSON inválido dos veces o QVAC no disponible: devuelve un fallo controlado, sin lanzar', async () => {
  const bad = await runCompetencyAnalysis({ interview: interviewOf(), profile: createEmptyProfile(), llm: scriptedLlm(['nada', '{}']) });
  assert.deepEqual([bad.ok, bad.reason], [false, 'json_invalido']);
  const down = await runCompetencyAnalysis({ interview: interviewOf(), profile: createEmptyProfile(), llm: scriptedLlm([new LlmUnavailableError('QVAC no respondió en 60 s.')]) });
  assert.deepEqual([down.ok, down.reason], [false, 'qvac_no_disponible']);
});

/* ───────── Integración con el perfil ───────── */

test('applyAnalysis agrega citas y evidencia sin bajar estados', () => {
  const v = validateAnalysis(JSON.parse(GOOD), ANSWERS, {});
  const base = createEmptyProfile();
  base.competencies.reposicion = { id: 'reposicion', status: 'evidencia', mentions: [], examples: [{ text: 'otro ejemplo', level: 'fuerte' }] };
  const p = applyAnalysis(base, { ok: true, model: 'scripted', ...v }, { at: '2026-10-27T00:00:00.000Z' });
  assert.equal(p.competencies.reposicion.status, 'evidencia', 'no baja de evidencia a declarada');
  assert.equal(p.competencies.control_existencias.status, 'evidencia');
  assert.equal(p.competencies.control_existencias.level, 'intermedio');
  assert.equal(p.competencies.control_existencias.examples[0].level, 'fuerte');
  assert.equal(p.competencies.control_existencias.mentions[0].origin, 'qvac');
  assert.deepEqual(p.analysis.missingInformation, ['Cómo registra lo que retira del anaquel']);
  assert.equal(applyAnalysis(p, { ok: true, model: 'scripted', ...v }).competencies.control_existencias.mentions.length, 1, 'no duplica citas');
});

/* ───────── Momento del análisis en el flujo ───────── */

test('el análisis se ejecuta UNA vez, al cerrar la entrevista, y no en cada mensaje', async () => {
  const llm = tracked([...TO_INTERVIEW, GOOD]);
  const { beforeClose, closed } = await playToClose(llm);
  assert.equal(beforeClose.session.stage, 'entrevista');
  assert.equal(llm.calls.filter(isAnalysis).length, 1);
  assert.ok(isAnalysis(llm.calls.at(-1)), 'es la última llamada, al cerrar');
  const p = closed.session.profile;
  assert.equal(p.analysis.ok, true);
  assert.equal(p.competencies.control_existencias.status, 'evidencia');
  assert.ok(closed.messages.some((m) => m.text.startsWith('Revisé todo lo que me contaste')));
  assert.ok(['evidencia', 'fin'].includes(closed.session.stage), 'después siguen los ejemplos del motor');
  // Las respuestas de la etapa de ejemplos no vuelven a llamar al análisis.
  let r = closed;
  while (r.session.stage === 'evidencia') r = await advanceAdaptiveDiagnosis(r.session, { skip: true }, { llm });
  assert.equal(r.session.stage, 'fin');
  assert.equal(llm.calls.filter(isAnalysis).length, 1);
});

test('si el análisis falla, la conversación sigue con el motor de reglas y lo dice', async () => {
  const llm = tracked([...TO_INTERVIEW, new LlmUnavailableError('QVAC no respondió en 60 s.')]);
  const { closed } = await playToClose(llm);
  assert.equal(closed.session.profile.analysis.ok, false);
  assert.equal(closed.session.profile.analysis.reason, 'qvac_no_disponible');
  assert.ok(closed.messages.some((m) => m.text.startsWith('No pude completar el análisis')));
  assert.ok(['evidencia', 'fin'].includes(closed.session.stage));
});

/* ───────── API y persistencia (base simulada) ───────── */

function memoryProfiles({ fail = false } = {}) {
  const rows = new Map();
  return {
    saves: [],
    async save(p) {
      this.saves.push(p);
      if (fail) throw new Error('conexión rechazada');
      rows.set(p.profileId, structuredClone(p));
    },
    async load(id) {
      return rows.get(id) || null;
    },
  };
}

async function apiToClose(app) {
  let r = await app('POST', '/diagnosis/start', null);
  const id = r.session.id;
  for (const input of [...BASICS, ...ANSWERS.map((text) => ({ text }))]) r = await app('POST', `/diagnosis/${id}/answer`, { input });
  return { id, before: r, closed: await app('POST', `/diagnosis/${id}/answer`, { input: { skip: true } }) };
}

test('API: guarda el perfil al generarlo y al terminar, nunca en los mensajes normales', async () => {
  const profiles = memoryProfiles();
  const app = createApp({ llm: scriptedLlm([...TO_INTERVIEW, GOOD]), profiles });
  const { id, before, closed } = await apiToClose(app);
  assert.equal(before.persistence, undefined, 'los turnos de conversación no guardan nada');
  assert.equal(closed.persistence.saved, true);
  assert.equal(profiles.saves.length, 1);
  const profileId = closed.session.profile.profileId;
  assert.match(profileId, /^[0-9a-f-]{36}$/);
  assert.equal(profiles.saves[0].competencies.control_existencias.status, 'evidencia');
  assert.equal(profiles.saves[0].messages, undefined, 'se guarda el perfil, no la sesión');

  let r = closed;
  while (r.session.stage === 'evidencia') r = await app('POST', `/diagnosis/${id}/answer`, { input: { skip: true } });
  assert.equal(r.persistence.saved, true);
  assert.equal(profiles.saves.length, 2);
  assert.equal(profiles.saves[1].profileId, profileId, 'mismo perfil, sin duplicarlo');
  assert.equal((await app('GET', `/profile/${profileId}`, null)).profileId, profileId);
});

test('API: un fallo al guardar se informa (saved: false) y la conversación sigue', async () => {
  const app = createApp({ llm: scriptedLlm([...TO_INTERVIEW, GOOD]), profiles: memoryProfiles({ fail: true }), log: () => {} });
  const { closed } = await apiToClose(app);
  assert.equal(closed.persistence.saved, false);
  assert.match(closed.persistence.error, /no se pudo guardar/i);
  assert.ok(['evidencia', 'fin'].includes(closed.session.stage));
});

test('API: GET /profile/:id responde 404 si no existe y 503 sin base de datos', async () => {
  const id = '00000000-0000-4000-8000-000000000000';
  await assert.rejects(createApp({ llm: scriptedLlm([]), profiles: memoryProfiles() })('GET', `/profile/${id}`, null), (e) => e.status === 404);
  await assert.rejects(createApp({ llm: scriptedLlm([]) })('GET', `/profile/${id}`, null), (e) => e.status === 503);
});
