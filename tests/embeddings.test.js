// Embeddings sin QVAC ni PostgreSQL: validación de vectores, texto que
// representa cada competencia y que la API no espera a los vectores.
// Las pruebas con QVAC real están en tests/embeddings.live.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COMPETENCIES } from '../src/data/competencies.js';
import { createApp } from '../server/app.js';
import { catalogCompetencyText, hashInput, profileCompetencyText, selectEvidence } from '../server/embeddings/texts.js';
import { InvalidEmbeddingError, normalizeBatch, resolveEmbeddingModel } from '../server/qvac/embeddings.js';
import { BASICS, notes, ques, scriptedLlm } from './helpers/conversation.js';

/* ───────── Validación de vectores ───────── */

test('normalizeBatch normaliza con L2 y conserva la dimensión', () => {
  const [v] = normalizeBatch([[3, 4]], 1);
  assert.deepEqual(v, [0.6, 0.8]);
});

test('normalizeBatch rechaza valores no finitos, dimensiones incoherentes, vectores nulos y lotes incompletos', () => {
  assert.throws(() => normalizeBatch([[1, Number.NaN]], 1), InvalidEmbeddingError);
  assert.throws(() => normalizeBatch([[1, Infinity]], 1), InvalidEmbeddingError);
  assert.throws(() => normalizeBatch([[1, 2], [1, 2, 3]], 2), InvalidEmbeddingError);
  assert.throws(() => normalizeBatch([[1, 2]], 1, 768), /768/);
  assert.throws(() => normalizeBatch([[0, 0]], 1), /norma cero/);
  assert.throws(() => normalizeBatch([[1, 2]], 2), /Se esperaban 2/);
  assert.throws(() => normalizeBatch([[1, '2']], 1), InvalidEmbeddingError);
});

test('solo se aceptan constantes de embeddings del SDK instalado', () => {
  assert.equal(resolveEmbeddingModel('EMBEDDINGGEMMA_300M_Q8_0').engine, 'llamacpp-embedding');
  assert.throws(() => resolveEmbeddingModel('QWEN3_4B_INST_Q4_K_M'), /no es un modelo de embeddings/);
  assert.throws(() => resolveEmbeddingModel('MODELO_INVENTADO'), /no existe/);
});

/* ───────── Texto que representa cada competencia ───────── */

test('catálogo: nombre, área y descripción reales, con el formato de documento de EmbeddingGemma', () => {
  const t = catalogCompetencyText('calculo_vuelto');
  assert.ok(t.text.startsWith(`${COMPETENCIES.calculo_vuelto.name}.`));
  assert.ok(t.text.includes(COMPETENCIES.calculo_vuelto.description));
  assert.ok(t.input.startsWith(`title: ${COMPETENCIES.calculo_vuelto.name} | text: `));
  assert.equal(t.format, 'retrieval_document');
  assert.equal(catalogCompetencyText('no_existe'), null);
});

test('perfil: catálogo + hasta tres citas reales (ejemplos fuertes primero), sin datos de contacto', () => {
  const evidence = [
    { kind: 'mencion', quote: 'Cobro con Yape', origin: 'reglas' },
    { kind: 'ejemplo', quote: 'Una vez la caja no cuadraba y revisé los vouchers', quality: 'fuerte', origin: 'qvac' },
    { kind: 'mencion', quote: 'Cobro con Yape', origin: 'qvac' },
    { kind: 'mencion', quote: 'Mi celular es 987 654 321', origin: 'reglas' },
    { kind: 'mencion', quote: 'Cuadro la caja al final', origin: 'reglas' },
  ];
  const quotes = selectEvidence(evidence);
  assert.equal(quotes[0], 'Una vez la caja no cuadraba y revisé los vouchers');
  assert.equal(quotes.length, 3);
  assert.ok(!quotes.join(' ').includes('987'), 'se omiten números largos');

  const t = profileCompetencyText({ id: 'manejo_dinero', evidence });
  assert.ok(t.text.startsWith(`${COMPETENCIES.manejo_dinero.name}: ${COMPETENCIES.manejo_dinero.description}`));
  assert.ok(t.text.includes('«Una vez la caja no cuadraba y revisé los vouchers»'));
  assert.equal(t.evidenceCount, 3);
  assert.ok(t.input.startsWith('task: search result | query: '));
  assert.equal(profileCompetencyText({ id: 'inventada', evidence }), null, 'no se embeben competencias inexistentes');
  assert.equal(profileCompetencyText({ id: 'manejo_dinero', evidence: [] }).evidenceCount, 0);
});

test('el hash cambia si cambia el texto, el modelo o el formato', () => {
  const h = hashInput('M', 'retrieval_query', 'a');
  assert.equal(h, hashInput('M', 'retrieval_query', 'a'));
  assert.notEqual(h, hashInput('M', 'retrieval_query', 'b'));
  assert.notEqual(h, hashInput('N', 'retrieval_query', 'a'));
  assert.notEqual(h, hashInput('M', 'retrieval_document', 'a'));
});

/* ───────── Integración con la API ───────── */

const GOOD = JSON.stringify({
  competencies: [{ id: 'reposicion', status: 'declarada', evidence: [{ quote: 'Repongo los anaqueles de abarrotes cada mañana', type: 'afirmacion' }], level: 'sin_nivel', level_reason: '' }],
  missing_information: [],
});
const LLM = () => scriptedLlm([ques('¿Cómo aprendiste?', { area: 'antes' }), notes(), ques('¿Qué pasó?'), notes(), ques('¿Y después?'), GOOD]);
const memoryProfiles = () => ({ async save() {}, async load() { return null; } });

async function closeInterview(app) {
  let r = await app('POST', '/diagnosis/start', null);
  const id = r.session.id;
  for (const input of [...BASICS, { text: 'Repongo los anaqueles de abarrotes cada mañana.' }, { text: 'El lunes retiré yogures vencidos.' }]) {
    r = await app('POST', `/diagnosis/${id}/answer`, { input });
  }
  return app('POST', `/diagnosis/${id}/answer`, { input: { skip: true } });
}

test('al guardar el perfil se agenda la indexación sin esperarla, y solo entonces', async () => {
  const scheduled = [];
  let release;
  const embeddings = {
    schedule(id) {
      scheduled.push(id);
      return new Promise((r) => (release = r)); // nunca resuelve durante la respuesta
    },
  };
  const app = createApp({ llm: LLM(), profiles: memoryProfiles(), embeddings });
  const r = await closeInterview(app);
  assert.equal(r.persistence.saved, true, 'la respuesta llegó aunque los embeddings siguen pendientes');
  assert.deepEqual(scheduled, [r.persistence.profileId]);
  release({ ok: true });
});

test('sin guardado correcto no se generan embeddings', async () => {
  const scheduled = [];
  const failing = { async save() { throw new Error('conexión rechazada'); }, async load() { return null; } };
  const app = createApp({ llm: LLM(), profiles: failing, embeddings: { schedule: (id) => scheduled.push(id) }, log: () => {} });
  const r = await closeInterview(app);
  assert.equal(r.persistence.saved, false);
  assert.deepEqual(scheduled, []);
});

test('POST /profile/:id/embeddings: 404 sin perfil, 503 reintentable si falla, 503 si no está configurado', async () => {
  const id = '00000000-0000-4000-8000-000000000000';
  const app = (r) => createApp({ llm: scriptedLlm([]), embeddings: { schedule: async () => r } });
  await assert.rejects(app({ ok: false, error: 'perfil_no_encontrado' })('POST', `/profile/${id}/embeddings`, null), (e) => e.status === 404);
  await assert.rejects(app({ ok: false, error: 'Generación: QVAC no respondió' })('POST', `/profile/${id}/embeddings`, null), (e) => e.status === 503 && e.extra.retryable);
  assert.deepEqual(await app({ ok: true, embedded: 2, unchanged: 0 })('POST', `/profile/${id}/embeddings`, null), { ok: true, embedded: 2, unchanged: 0 });
  await assert.rejects(createApp({ llm: scriptedLlm([]) })('POST', `/profile/${id}/embeddings`, null), (e) => e.status === 503);
});
