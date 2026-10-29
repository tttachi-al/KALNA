import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCCUPATIONS } from '../src/data/occupations.js';
import { createPassportService } from '../server/passport/service.js';
import { createApp } from '../server/app.js';
import { evaluateJob } from '../server/matching/compatibility.js';
import { buildPassportContent, PASSPORT_VERSION } from '../src/services/engine/passportContent.js';

const profileId = '00000000-0000-4000-8000-000000000001';
const quote = 'Ayer conté los billetes y monedas al cerrar la tienda y comparé el total con las ventas.';
const second = 'Una vez un cliente reclamó por un cobro y escuché su problema antes de revisar el comprobante.';
const comp = (id, text, status = 'evidencia') => ({ id, status, mentions: [], examples: [{ text, level: 'fuerte' }] });
const profile = { profileId, competencies: { manejo_dinero: comp('manejo_dinero', quote), atencion_cliente: comp('atencion_cliente', second) }, experience: { formality: 'informal' } };
const extracted = (id, text = quote) => ({ id, status: 'evidencia', evidence: [{ quote: text, type: 'ejemplo_concreto' }], level: 'sin_nivel', level_reason: '' });

function fixture({ semantic = true, invalid = false, inferenceError = false, output = [] } = {}) {
  const records = new Map();
  const pool = { async query(sql, args) {
    const key = `${args[0]}:${args[1]}`;
    assert.ok(sql.includes('employability_passports'));
    if (sql.startsWith('SELECT route')) return { rows: records.has(key) ? [{ route: records.get(key) }] : [] };
    records.set(key, args[2]);
    return { rows: [] };
  } };
  const llm = { calls: 0, history: null, describe: () => ({ model: 'test-only' }), async generate({ history }) {
    this.calls++; this.history = history;
    if (inferenceError) throw new Error('inference unavailable');
    return { text: invalid ? 'invalid' : JSON.stringify({ competencies: output, missing_information: [] }), model: 'test-only' };
  } };
  const recommender = { async compare(_profile, job) {
    const own = new Map(Object.values(_profile.competencies).map((c) => [c.id, { status: c.status, quotes: c.examples.map((e) => e.text) }]));
    return { result: evaluateJob({ job, own }), diagnostics: { semantic, model: { model: 'embedding-test-only' } } };
  }, async suggest() { return [{ quote, candidates: [{ id: 'registro_transacciones', similarity: .8 }] }]; } };
  const loadDestination = async (id) => OCCUPATIONS[id] || null;
  return { svc: createPassportService({ pool, recommender, llm, loadDestination }), llm, records, pool, recommender, loadDestination };
}

test('experiencia suficiente: perfil, fortalezas, valor diferencial y presentación con citas; nunca ruta', async () => {
  const { svc, llm } = fixture();
  assert.equal(await svc.get(profileId, 'cajero'), null);
  assert.equal(llm.calls, 0);
  const a = await svc.build(profile, 'cajero');
  assert.equal(a.persistence.saved, true);
  assert.equal(a.strengths.length, 2);
  assert.ok(a.presentation && a.differential && a.pitch);
  for (const value of [a.presentation, a.differential, a.pitch, ...a.strengths]) assert.ok(value.sourceIds.length);
  for (const field of ['stages', 'total', 'progress', 'priorityGaps', 'classification']) assert.equal(field in a, false);
  assert.match(llm.history[1].content, /PUESTO OBJETIVO.*Cajero/);
  await svc.build(profile, 'cajero');
  assert.equal(llm.calls, 1);
  const b = await svc.build(profile, 'limpieza');
  assert.equal(b.occupationId, 'limpieza');
  assert.notDeepEqual(a.strengths, b.strengths);
});

test('experiencia limitada o vacía: preguntas concretas y sin presentación ficticia', async () => {
  const { svc, llm } = fixture();
  const limited = { ...profile, competencies: { manejo_dinero: { id: 'manejo_dinero', status: 'declarada', mentions: [{ quote: 'Trabajé de cajero.' }], examples: [] } } };
  const p = await svc.build(limited, 'cajero');
  assert.equal(p.presentation, null);
  assert.equal(p.pitch, null);
  assert.equal(p.differential, null);
  assert.ok(p.questions.length);
  const empty = await svc.build({ ...profile, competencies: {} }, 'cajero');
  assert.ok(empty.questions.every((q) => q.text && q.competencyId));
  assert.equal(llm.calls, 1, 'sin relatos no inventa una inferencia');
});

test('inferencia nueva requiere cita literal, señal semántica y confirmación; no modifica el perfil', async () => {
  const { svc } = fixture({ output: [extracted('registro_transacciones')] });
  const before = JSON.stringify(profile);
  const p = await svc.build(profile, 'cajero');
  assert.equal(p.inferred[0].status, 'inferida_por_confirmar');
  assert.equal(p.inferred[0].competencyId, 'registro_transacciones');
  assert.ok(p.inferred[0].question);
  assert.equal(p.strengths.some((s) => s.competencyId === 'registro_transacciones'), false);
  assert.equal(JSON.stringify(profile), before);
  assert.ok(!p.pitch.text.includes('registro de transacciones'));
});

test('descarta citas inventadas, competencias ajenas al puesto y descartadas por la persona', async () => {
  const { svc } = fixture({ output: [extracted('registro_transacciones', 'Tengo un certificado de caja.'), extracted('protocolos'), extracted('medios_pago')] });
  const p = await svc.build({ ...profile, dismissed: ['medios_pago'] }, 'cajero');
  assert.deepEqual(p.inferred, []);
  assert.ok(!JSON.stringify(p).includes('Tengo un certificado'));
});

test('fallos de modelos, embeddings o JSON no guardan pasaportes ficticios', async () => {
  for (const options of [{ semantic: false }, { invalid: true }, { inferenceError: true }]) {
    const { svc } = fixture(options);
    await assert.rejects(svc.build(profile, 'cajero'), (e) => e.status === 503);
    assert.equal(await svc.get(profileId, 'cajero'), null);
  }
});

test('persistencia sobrevive a nueva instancia y documentos antiguos se regeneran solo con POST', async () => {
  const f = fixture();
  f.records.set(`${profileId}:cajero`, { stages: [], progress: {} });
  assert.equal(await f.svc.get(profileId, 'cajero'), null);
  const a = await f.svc.build(profile, 'cajero');
  assert.equal(a.version, PASSPORT_VERSION);
  const restarted = createPassportService({ pool: f.pool, recommender: f.recommender, llm: f.llm, loadDestination: f.loadDestination });
  assert.deepEqual(await restarted.get(profileId, 'cajero'), a);
  assert.equal(await restarted.get(profileId, 'limpieza'), null);
  assert.equal(f.llm.calls, 1);
});

test('transferencia respalda su competencia de origen y no acredita la de destino', () => {
  const p = buildPassportContent({ profile, destination: OCCUPATIONS.cajero, evaluation: { transferable: [{ id: 'registro_transacciones', from: { id: 'manejo_dinero' }, why: 'Permite aprovechar tu experiencia al revisar cobros.' }] } });
  assert.equal(p.transferable[0].baseId, 'manejo_dinero');
  assert.equal(p.transferable[0].status, 'transferible_por_confirmar');
  assert.ok(p.transferable[0].sourceIds.length);
});

test('API usa perfil del servidor, no acepta perfil inventado; progreso queda en la ruta', async () => {
  let received;
  const app = createApp({ llm: {}, profiles: { load: async () => ({ ...profile, competencies: [{ id: 'manejo_dinero', status: 'evidencia', evidence: [{ kind: 'ejemplo', quote, quality: 'fuerte' }] }] }) }, passports: {
    async build(p, id) { received = p; return { occupationId: id }; }, async get() { return null; },
  } });
  await assert.rejects(app('POST', '/passport', {}), (e) => e.status === 400);
  assert.deepEqual(await app('POST', '/passport', { profileId, occupationId: 'cajero', profile: { invented: true } }), { occupationId: 'cajero' });
  assert.equal(received.competencies.manejo_dinero.examples[0].text, quote);
  assert.equal(received.invented, undefined);
  await assert.rejects(app('PUT', `/profile/${profileId}/passports/cajero/progress`, { progress: {} }), (e) => e.status === 410);
});
