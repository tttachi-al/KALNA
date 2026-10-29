// Compatibilidad laboral y recomendación SIN QVAC ni PostgreSQL: la fórmula
// es una función pura y el recomendador recibe una búsqueda semántica simulada.
// Las pruebas con QVAC real y PostgreSQL están en tests/embeddings.live.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../server/app.js';
import { evaluateJob, rankResults, transferStrength } from '../server/matching/compatibility.js';
import { MATCHING_CONFIG } from '../server/matching/config.js';
import { createRecommender } from '../server/matching/recommend.js';
import { advanceAdaptiveDiagnosis, startAdaptiveDiagnosis } from '../server/interview/flow.js';
import { ANALYSIS_FORMAT } from '../server/competencies/schema.js';
import { BASICS, notes, ques, scriptedLlm } from './helpers/conversation.js';

const own = (entries) => new Map(entries.map(([id, status, quote = `cita de ${id}`]) => [id, { status, quotes: [quote] }]));
const JOB = {
  id: 'sint_prueba',
  name: 'Auxiliar de almacén',
  sector: 'Logística',
  summary: 'Recibe y ordena mercadería.',
  requires: [
    { id: 'recepcion_mercaderia', weight: 'clave' },
    { id: 'org_productos', weight: 'clave' },
    { id: 'registro_info', weight: 'complementaria' },
  ],
  requirements: [
    { kind: 'certificacion', text: 'Certificado de operador de montacargas', mandatory: true },
    { kind: 'condicion', text: 'Turnos rotativos', mandatory: false },
  ],
};

/* ───────── Fórmula ───────── */

test('coincidencia directa con evidencia en todas las clave → banda alta y cobertura explicable', () => {
  const r = evaluateJob({ job: { ...JOB, requirements: [] }, own: own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia'], ['registro_info', 'declarada']]) });
  assert.equal(r.band, 'alta');
  assert.equal(r.closeness, 'muy-cercana');
  assert.equal(r.ratio, Math.round(((1 + 1 + 0.5 * 0.7) / 2.5) * 1000) / 1000);
  assert.deepEqual(r.keyCompetencies, { total: 2, direct: 2, transferable: 0 });
  assert.equal(r.matches[0].quote, 'cita de recepcion_mercaderia', 'cada coincidencia trae su evidencia');
});

test('declarada y por validar cuentan menos que con evidencia', () => {
  const ev = evaluateJob({ job: JOB, own: own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia']]) }).ratio;
  const de = evaluateJob({ job: JOB, own: own([['recepcion_mercaderia', 'declarada'], ['org_productos', 'declarada']]) }).ratio;
  const pv = evaluateJob({ job: JOB, own: own([['recepcion_mercaderia', 'por_validar'], ['org_productos', 'por_validar']]) }).ratio;
  assert.ok(ev > de && de > pv);
  assert.notEqual(evaluateJob({ job: JOB, own: own([['recepcion_mercaderia', 'declarada'], ['org_productos', 'declarada']]) }).band, 'alta', 'sin evidencia no es alta');
});

test('una competencia transferible NO equivale a experiencia directa', () => {
  // org_documentos es base de org_productos en el catálogo.
  const transfer = evaluateJob({ job: JOB, own: own([['recepcion_mercaderia', 'evidencia'], ['org_documentos', 'evidencia']]) });
  const direct = evaluateJob({ job: JOB, own: own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia']]) });
  const t = transfer.transferable.find((x) => x.id === 'org_productos');
  assert.ok(t, 'aparece como transferible');
  assert.equal(t.via, 'bases');
  assert.equal(t.from.id, 'org_documentos');
  assert.ok(!transfer.matches.some((m) => m.id === 'org_productos'), 'no se cuenta como coincidencia');
  assert.ok(transfer.ratio < direct.ratio);
  assert.ok(t.strength <= MATCHING_CONFIG.transfer.bases);
  assert.ok(transfer.reasons.some((x) => /no equivale a experiencia directa/.test(x)));
});

test('la transferencia semántica solo cuenta sobre el umbral calibrado y con tope', () => {
  const lo = MATCHING_CONFIG.semantic.transfer;
  assert.equal(transferStrength('ventas', 'org_materiales', lo - 0.01), null);
  const t = transferStrength('ventas', 'org_materiales', 0.95);
  assert.equal(t.via, 'semantica');
  assert.ok(t.strength <= MATCHING_CONFIG.transfer.semanticMax && t.strength < MATCHING_CONFIG.transfer.bases);
});

test('solo una evidencia «posible» (no validada) no produce una recomendación', () => {
  const r = evaluateJob({ job: JOB, own: own([]), possible: new Map([['org_productos', { quote: 'hacía de todo un poco', similarity: 0.6 }]]) });
  assert.equal(r.band, null);
  assert.equal(r.possible[0].id, 'org_productos');
  assert.deepEqual(rankResults([r]), []);
});

test('los requisitos no verificados quedan pendientes y no restan cobertura', () => {
  const ownSet = own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia'], ['registro_info', 'evidencia']]);
  const job = { ...JOB, requirements: [...JOB.requirements, { kind: 'educacion', text: 'Secundaria completa', mandatory: true }] };
  const withReq = evaluateJob({ job: { ...job, requirements: job.requirements.filter((r) => r.kind !== 'certificacion') }, own: ownSet });
  const noReq = evaluateJob({ job: { ...JOB, requirements: [] }, own: ownSet });
  assert.deepEqual(withReq.pendingRequirements, [{ kind: 'educacion', text: 'Secundaria completa', status: 'por_verificar' }]);
  assert.equal(withReq.ratio, noReq.ratio);
  assert.equal(withReq.band, noReq.band);
  assert.deepEqual(withReq.optionalRequirements, [{ kind: 'condicion', text: 'Turnos rotativos' }]);
});

test('una certificación o licencia obligatoria sin verificar limita la banda a «media» sin restar cobertura', () => {
  const ownSet = own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia'], ['registro_info', 'evidencia']]);
  const barrier = evaluateJob({ job: JOB, own: ownSet });
  const free = evaluateJob({ job: { ...JOB, requirements: [] }, own: ownSet });
  assert.equal(free.band, 'alta');
  assert.equal(barrier.band, 'media');
  assert.equal(barrier.ratio, free.ratio);
  assert.ok(barrier.reasons.some((r) => /falta verificarlo/.test(r)));
});

test('el orden respeta la banda y la similitud de tareas solo desempata', () => {
  const a = { ...evaluateJob({ job: { ...JOB, id: 'a' }, own: own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia']]) }) };
  const b = { ...evaluateJob({ job: { ...JOB, id: 'b' }, own: own([['recepcion_mercaderia', 'declarada']]), tasks: [{ task: 't', quote: 'q', similarity: 0.99 }] }) };
  assert.deepEqual(rankResults([b, a]).map((r) => r.jobId), ['a', 'b']);
});

/* ───────── Regresiones de la revisión de calidad (compat-v3) ───────── */

test('regresión: una competencia que la persona tiene «por validar» sigue siendo directa aunque otra la transfiera con más fuerza', () => {
  // org_documentos (con evidencia) es base de org_productos: transferir valdría 1 × 0,5 = 0,5 > 0,4.
  const r = evaluateJob({ job: { ...JOB, requirements: [] }, own: own([['org_productos', 'por_validar', 'acomodaba cosas'], ['org_documentos', 'evidencia']]) });
  const m = r.matches.find((x) => x.id === 'org_productos');
  assert.ok(m, 'aparece en «Ya tienes»');
  assert.equal(m.status, 'por_validar');
  assert.ok(!r.transferable.some((t) => t.id === 'org_productos'));
});

test('regresión: una licencia obligatoria sin verificar también limita la banda a «media»', () => {
  const ownSet = own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia'], ['registro_info', 'evidencia']]);
  const lic = evaluateJob({ job: { ...JOB, requirements: [{ kind: 'licencia', text: 'Licencia de conducir para motocicleta vigente', mandatory: true }] }, own: ownSet });
  const optional = evaluateJob({ job: { ...JOB, requirements: [{ kind: 'licencia', text: 'Licencia de moto (deseable)', mandatory: false }] }, own: ownSet });
  assert.equal(lic.band, 'media');
  assert.equal(optional.band, 'alta', 'una licencia opcional no limita la banda');
  assert.equal(lic.ratio, optional.ratio, 'el requisito no resta cobertura');
  assert.equal(lic.pendingRequirements[0].status, 'por_verificar');
});

test('la relevancia por descripción solo ordena dentro de la banda; no cambia bandas ni cobertura', () => {
  const ownSet = own([['recepcion_mercaderia', 'declarada']]);
  const a = { ...evaluateJob({ job: { ...JOB, id: 'a', requirements: [] }, own: ownSet }), descriptionRelevance: 0 };
  const b = { ...evaluateJob({ job: { ...JOB, id: 'b', requirements: [] }, own: ownSet }), descriptionRelevance: 1 };
  assert.equal(a.band, b.band);
  assert.equal(a.ratio, b.ratio);
  assert.deepEqual(rankResults([a, b]).map((r) => r.jobId), ['b', 'a']);
  const strong = evaluateJob({ job: { ...JOB, id: 'c', requirements: [] }, own: own([['recepcion_mercaderia', 'evidencia'], ['org_productos', 'evidencia']]) });
  assert.equal(rankResults([b, strong])[0].jobId, 'c', 'una banda mayor gana aunque la descripción se parezca menos');
});

/* ───────── Recomendador (búsqueda semántica simulada) ───────── */

function fakePool(jobs) {
  return {
    async query(sql) {
      if (/FROM occupations WHERE is_synthetic/.test(sql)) return { rows: jobs.map(({ id, name, sector, summary }) => ({ id, name, sector, summary })) };
      if (/FROM occupation_competencies/.test(sql)) return { rows: jobs.flatMap((j) => j.requires.map((r) => ({ occupation_id: j.id, competency_id: r.id, weight: r.weight }))) };
      if (/FROM occupation_requirements/.test(sql)) return { rows: jobs.flatMap((j) => j.requirements.map((r) => ({ occupation_id: j.id, kind: r.kind, description: r.text, mandatory: r.mandatory }))) };
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
}
const fakeSemantic = ({ scores = [], tasks = [] } = {}) => ({
  modelKey: async () => ({ model: 'TEST', version: 't' }),
  competencySimilarity: async () => new Map(),
  embedEvidence: async (quotes) => quotes.map((q) => ({ text: q, vector: [1] })),
  competencyScores: async () => scores,
  taskMatches: async () => tasks,
});
const OTHER = { ...JOB, id: 'sint_caja', name: 'Cajero', requires: [{ id: 'manejo_dinero', weight: 'clave' }], requirements: [] };
const comp = (id, status, quote) => ({ id, status, mentions: [{ quote, source: 'entrevista' }], examples: status === 'evidencia' ? [{ text: quote, level: 'fuerte' }] : [] });

test('recomendador: perfil vacío o solo con descartes → sin recomendaciones', async () => {
  const rec = createRecommender({ pool: fakePool([JOB]), semantic: fakeSemantic() });
  assert.deepEqual((await rec.recommend({ competencies: {}, dismissed: [] })).results, []);
  const onlyDismissed = { competencies: { org_productos: comp('org_productos', 'evidencia', 'ordenaba') }, dismissed: ['org_productos'] };
  assert.deepEqual((await rec.recommend(onlyDismissed)).results, []);
});

test('recomendador: las competencias descartadas no se usan para recomendar', async () => {
  const rec = createRecommender({ pool: fakePool([JOB, OTHER]), semantic: fakeSemantic() });
  const profile = {
    competencies: { recepcion_mercaderia: comp('recepcion_mercaderia', 'evidencia', 'recibía cajas'), manejo_dinero: comp('manejo_dinero', 'evidencia', 'cuadraba la caja') },
    dismissed: [],
  };
  assert.deepEqual((await rec.recommend(profile)).results.map((r) => r.jobId).sort(), ['sint_caja', 'sint_prueba']);
  const r = await rec.recommend({ ...profile, dismissed: ['manejo_dinero'] });
  assert.deepEqual(r.results.map((x) => x.jobId), ['sint_prueba']);
});

test('recomendador: una tarea parecida recupera el empleo, pero la compatibilidad la deciden las competencias', async () => {
  const sem = fakeSemantic({ tasks: [{ occupationId: 'sint_caja', task: 'Cobrar', similarity: 0.7 }] });
  const rec = createRecommender({ pool: fakePool([JOB, OTHER]), semantic: sem });
  const r = await rec.recommend({ competencies: { recepcion_mercaderia: comp('recepcion_mercaderia', 'evidencia', 'recibía cajas') }, dismissed: [] });
  assert.equal(r.diagnostics.candidates.porTareas, 1);
  assert.ok(!r.results.some((x) => x.jobId === 'sint_caja'), 'sin competencias del empleo no se recomienda solo por la tarea');
});

test('recomendador: una tarea parecida y una evidencia «posible» no bastan para recomendar sin competencias del empleo', async () => {
  const sem = {
    ...fakeSemantic({ tasks: [{ occupationId: 'sint_caja', task: 'Cobrar', similarity: 0.7 }], scores: [{ competencyId: 'manejo_dinero', similarity: 0.9 }] }),
  };
  const rec = createRecommender({ pool: fakePool([OTHER]), semantic: sem });
  const r = await rec.recommend({ competencies: { recepcion_mercaderia: comp('recepcion_mercaderia', 'declarada', 'hacía de todo un poco en la tienda') }, dismissed: [] });
  assert.deepEqual(r.results, []);
});

test('recomendador: usa la descripción del empleo para ordenar candidatos ya recuperados', async () => {
  const twin = { ...JOB, id: 'sint_gemelo', name: 'Gemelo', requirements: [] };
  const base = { ...JOB, requirements: [] };
  const sem = { ...fakeSemantic(), descriptionScores: async () => new Map([['sint_prueba', 0.40], ['sint_gemelo', 0.62]]) };
  const rec = createRecommender({ pool: fakePool([base, twin]), semantic: sem });
  const r = await rec.recommend({ competencies: { recepcion_mercaderia: comp('recepcion_mercaderia', 'declarada', 'recibía cajas') }, dismissed: [] });
  assert.deepEqual(r.results.map((x) => x.jobId), ['sint_gemelo', 'sint_prueba']);
  assert.equal(r.results[0].descriptionRelevance, 1);
  assert.equal(r.results[0].ratio, r.results[1].ratio, 'la cobertura no cambia');
});

test('recomendador: si la búsqueda semántica falla, sigue con coincidencias directas y lo informa', async () => {
  const broken = { ...fakeSemantic(), competencySimilarity: async () => { throw new Error('modelo no cargado'); } };
  const rec = createRecommender({ pool: fakePool([JOB]), semantic: broken });
  const r = await rec.recommend({ competencies: { recepcion_mercaderia: comp('recepcion_mercaderia', 'evidencia', 'recibía cajas') }, dismissed: [] });
  assert.equal(r.diagnostics.semantic, false);
  assert.equal(r.results[0].jobId, 'sint_prueba');
});

test('candidatas semánticas: solo sobre el umbral y cerca de la mejor', async () => {
  const s = MATCHING_CONFIG.semantic;
  const sem = fakeSemantic({
    scores: [
      { competencyId: 'org_documentos', similarity: s.candidate + 0.05 },
      { competencyId: 'org_materiales', similarity: s.candidate + 0.03 },
      { competencyId: 'ventas', similarity: s.candidate + 0.01 },
    ],
  });
  const rec = createRecommender({ pool: fakePool([]), semantic: sem });
  const out = await rec.suggest(['Ordenaba los libros por temas'], { dismissed: ['org_materiales'] });
  assert.deepEqual(out[0].candidates.map((c) => c.id), ['org_documentos'], 'descartada fuera; la lejana fuera');
  const none = createRecommender({ pool: fakePool([]), semantic: fakeSemantic({ scores: [{ competencyId: 'ventas', similarity: s.candidate - 0.01 }] }) });
  assert.deepEqual(await none.suggest(['Juego fútbol']), []);
});

/* ───────── API ───────── */

test('POST /jobs/recommend usa el recomendador del backend; sin él responde 503 (no el catálogo estático)', async () => {
  const fake = { recommend: async () => ({ results: [{ jobId: 'sint_x', synthetic: true }], diagnostics: { candidates: { total: 1 }, configVersion: 'compat-v1' } }) };
  assert.deepEqual(await createApp({ llm: scriptedLlm([]), recommender: fake })('POST', '/jobs/recommend', { profile: {}, limit: 3 }), [{ jobId: 'sint_x', synthetic: true }]);
  await assert.rejects(createApp({ llm: scriptedLlm([]) })('POST', '/jobs/recommend', { profile: {} }), (e) => e.status === 503);
});

/* ───────── Identificación de competencias con pistas semánticas ───────── */

test('al cerrar la entrevista, las candidatas semánticas llegan como PISTAS al análisis y las no validadas quedan «por confirmar»', async () => {
  const analysis = JSON.stringify({ competencies: [{ id: 'reposicion', status: 'declarada', evidence: [{ quote: 'Repongo los anaqueles de abarrotes cada mañana', type: 'afirmacion' }], level: 'sin_nivel', level_reason: '' }], missing_information: [] });
  const llm = scriptedLlm([ques('¿Cómo aprendiste?', { area: 'antes' }), notes(), ques('¿Qué pasó?'), notes(), ques('¿Y después?'), analysis]);
  const calls = [];
  const generate = llm.generate;
  llm.generate = (p) => (calls.push(p), generate(p));
  const semantic = { suggest: async (fragments) => [{ quote: fragments[0], candidates: [{ id: 'reposicion', similarity: 0.6 }, { id: 'control_existencias', similarity: 0.58 }] }] };
  let r = startAdaptiveDiagnosis();
  for (const input of BASICS) r = await advanceAdaptiveDiagnosis(r.session, input, { llm, semantic });
  for (const text of ['Repongo los anaqueles de abarrotes cada mañana y reviso fechas.', 'El lunes retiré yogures vencidos y avisé al encargado.']) r = await advanceAdaptiveDiagnosis(r.session, { text }, { llm, semantic });
  r = await advanceAdaptiveDiagnosis(r.session, { skip: true }, { llm, semantic });
  const call = calls.find((c) => c.responseFormat === ANALYSIS_FORMAT);
  assert.match(call.history.at(-1).content, /PISTAS/);
  const a = r.session.profile.analysis;
  assert.equal(a.semanticHints, 1);
  assert.ok(r.session.profile.competencies.reposicion, 'la validada entra al perfil');
  assert.ok(!a.pendingValidation.some((c) => c.id === 'reposicion'));
  // control_existencias no fue validada por el análisis: queda por confirmar salvo que el motor de reglas ya la tenga.
  if (!r.session.profile.competencies.control_existencias) assert.ok(a.pendingValidation.some((c) => c.id === 'control_existencias' && c.status === 'por_confirmar'));
});

test('si la búsqueda semántica falla, el análisis sigue sin pistas', async () => {
  const analysis = JSON.stringify({ competencies: [], missing_information: [] });
  const llm = scriptedLlm([ques('¿Cómo aprendiste?', { area: 'antes' }), notes(), ques('¿Qué pasó?'), notes(), ques('¿Y después?'), analysis]);
  const semantic = { suggest: async () => { throw new Error('sin base de datos'); } };
  let r = startAdaptiveDiagnosis();
  for (const input of BASICS) r = await advanceAdaptiveDiagnosis(r.session, input, { llm, semantic });
  for (const text of ['Repongo los anaqueles.', 'Reviso fechas.']) r = await advanceAdaptiveDiagnosis(r.session, { text }, { llm, semantic });
  r = await advanceAdaptiveDiagnosis(r.session, { skip: true }, { llm, semantic });
  assert.equal(r.session.profile.analysis.ok, true);
  assert.equal(r.session.profile.analysis.semanticHints, 0);
  assert.ok(r.session.interview.log.some((l) => l.analisis && l.errorPistas === 'sin base de datos'));
});
