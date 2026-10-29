// Embeddings, búsqueda semántica y compatibilidad con QVAC REAL y PostgreSQL REAL.
//
//   KALLPA_QVAC_LIVE=1 npm run test:embeddings
//
// Nada de lo que se mide aquí está simulado: vectores de EMBEDDINGGEMMA_300M_Q8_0
// y consultas pgvector sobre los 50 empleos sintéticos guardados. Crea un
// perfil de prueba y lo borra al final (solo ese perfil, por su id).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { close as closeQvac } from '@qvac/sdk';

import { COMPETENCIES } from '../src/data/competencies.js';
import { createEmptyProfile } from '../src/services/engine/profile.js';
import { createApp } from '../server/app.js';
import { syncCatalog } from '../server/db/catalog.js';
import { migrate } from '../server/db/migrate.js';
import { createPool } from '../server/db/pool.js';
import { createProfileStore, ensureProfileId } from '../server/db/profiles.js';
import { createEmbeddingIndexer } from '../server/embeddings/indexer.js';
import { AMBIGUOUS, JOB_CASES, NEGATIVES, POSITIVES } from '../server/matching/calibration-cases.js';
import { MATCHING_CONFIG } from '../server/matching/config.js';
import { createRecommender } from '../server/matching/recommend.js';
import { createSemanticIndex } from '../server/matching/semantic.js';
import { createQvacEmbedder } from '../server/qvac/embeddings.js';
import { scriptedLlm } from './helpers/conversation.js';

const LIVE = process.env.KALLPA_QVAC_LIVE === '1';
const MODEL = process.env.KALLPA_EMBED_MODEL || 'EMBEDDINGGEMMA_300M_Q8_0';
const skip = !LIVE ? 'define KALLPA_QVAC_LIVE=1 para usar QVAC real' : !process.env.DATABASE_URL ? 'define DATABASE_URL' : false;

const pool = LIVE ? createPool(process.env.DATABASE_URL) : null;
const embedder = LIVE ? createQvacEmbedder({ modelName: MODEL, log: (m) => console.log(`[emb] ${m}`) }) : null;
const semantic = LIVE ? createSemanticIndex({ pool, embedder }) : null;
const recommender = LIVE ? createRecommender({ pool, semantic }) : null;
let profileId = null;

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const Q = (t) => `task: sentence similarity | query: ${t}`;
const comp = (id, status, quote) => ({ id, status, mentions: [{ quote, source: 'entrevista' }], examples: status === 'evidencia' ? [{ text: quote, level: 'fuerte' }] : [] });

before(async () => {
  if (skip) return;
  await migrate(pool);
  await syncCatalog(pool);
});

after(async () => {
  if (!LIVE) return;
  if (profileId) await pool?.query('DELETE FROM job_profiles WHERE id = $1', [profileId]);
  await embedder?.close().catch(() => {});
  await closeQvac().catch(() => {});
  await pool?.end();
});

test(`[QVAC real · ${MODEL}] el modelo se carga y un texto en español da un vector válido de 768`, { skip }, async () => {
  await embedder.load();
  const d = embedder.describe();
  assert.equal(d.status, 'ready');
  assert.match(d.modelVersion, /^[0-9a-f]{64}$/);
  const { vectors: [v], dim } = await embedder.embed(['Cobro a los clientes en efectivo y con Yape, y doy el vuelto correcto.']);
  console.log(`   versión ${d.modelVersion.slice(0, 12)}… · dimensiones ${dim}`);
  assert.equal(v.length, 768);
  assert.ok(v.every(Number.isFinite));
  assert.ok(Math.abs(Math.sqrt(dot(v, v)) - 1) < 1e-6);
});

test(`[QVAC real · ${MODEL}] textos similares puntúan más que uno claramente distinto`, { skip }, async () => {
  const { vectors: [a, b, c] } = await embedder.embed([
    Q('Repongo los anaqueles y pongo adelante los productos que vencen primero.'),
    Q('Abastezco las góndolas rotando la mercadería por fecha de caducidad.'),
    Q('Atiendo llamadas y agendo citas en la computadora de la oficina.'),
  ]);
  assert.ok(dot(a, b) > dot(a, c));
});

test(`[QVAC real · ${MODEL}] indexar dos veces no duplica: referencias, 50 empleos y sus tareas`, { skip }, async () => {
  const indexer = createEmbeddingIndexer({ pool, embedder, profiles: createProfileStore(pool) });
  await indexer.indexCatalog();
  await indexer.indexOccupations();
  const again = [await indexer.indexCatalog(), await indexer.indexOccupations()];
  assert.deepEqual(again.map((r) => r.embedded), [0, 0], 'la segunda ejecución no genera vectores');
  const v = embedder.describe().modelVersion;
  const { rows: [c] } = await pool.query(
    `SELECT
      (SELECT count(*) FROM competency_embeddings WHERE model = $1 AND model_version = $2 AND dim = 768)::int refs,
      (SELECT count(DISTINCT competency_id) FROM competency_embeddings WHERE model = $1 AND model_version = $2)::int comps,
      (SELECT count(DISTINCT occupation_id) FROM occupation_embeddings oe JOIN occupations o ON o.id = oe.occupation_id AND o.is_synthetic WHERE model = $1 AND model_version = $2 AND text_kind = 'descripcion')::int empleos,
      (SELECT count(*) FROM occupation_embeddings WHERE model = $1 AND model_version = $2 AND text_kind = 'tareas' AND dim = 768)::int tareas,
      (SELECT sum(cardinality(tasks)) FROM occupations WHERE is_synthetic)::int tareas_esperadas,
      (SELECT count(*) FROM (SELECT occupation_id, text_kind, chunk FROM occupation_embeddings WHERE model = $1 GROUP BY 1,2,3 HAVING count(*) > 1) d)::int duplicados`,
    [MODEL, v],
  );
  console.log(`   ${c.refs} referencias de ${c.comps} competencias · ${c.empleos} empleos · ${c.tareas} tareas`);
  assert.equal(c.comps, Object.keys(COMPETENCIES).length);
  assert.equal(c.refs, 160);
  assert.equal(c.empleos, 50);
  assert.equal(c.tareas, c.tareas_esperadas);
  assert.equal(c.duplicados, 0);
});

test(`[QVAC real · ${MODEL}] evidencias con palabras distintas encuentran su competencia (top-3)`, { skip }, async () => {
  const vecs = await semantic.embedEvidence(POSITIVES.map((p) => p.text));
  let hits = 0;
  for (const [i, p] of POSITIVES.entries()) {
    const scores = await semantic.competencyScores(vecs[i].vector);
    if (scores.slice(0, 3).some((s) => p.expected.includes(s.competencyId))) hits += 1;
  }
  console.log(`   top-3: ${hits}/${POSITIVES.length}`);
  assert.ok(hits / POSITIVES.length >= 0.9);
});

test(`[QVAC real · ${MODEL}] experiencias sin equivalente y frases ambiguas no superan el umbral de «posible»`, { skip }, async () => {
  for (const t of [...NEGATIVES, ...AMBIGUOUS]) {
    const [{ vector }] = await semantic.embedEvidence([t]);
    const [top] = await semantic.competencyScores(vector);
    assert.ok(top.similarity < MATCHING_CONFIG.semantic.possible, `«${t}» → ${top.competencyId} ${top.similarity.toFixed(3)}`);
  }
  const suggestions = await recommender.suggest(NEGATIVES);
  assert.equal(suggestions.length, 0, 'ninguna candidata para experiencias sin equivalente en el catálogo');
});

test(`[QVAC real · ${MODEL}] las tareas de los empleos recuperan empleos pertinentes`, { skip }, async () => {
  let hits = 0;
  for (const c of JOB_CASES) {
    const [{ vector }] = await semantic.embedEvidence([c.text]);
    const tasks = await semantic.taskMatches(vector, { minSimilarity: -1, limit: 5 });
    if (tasks.some((t) => c.expected.includes(t.occupationId))) hits += 1;
  }
  console.log(`   algún empleo pertinente en el top-5: ${hits}/${JOB_CASES.length}`);
  assert.ok(hits >= 5);
});

test(`[QVAC real · ${MODEL}] actividad cotidiana → transferencia, nunca experiencia directa`, { skip }, async () => {
  const profile = {
    competencies: { org_documentos: comp('org_documentos', 'declarada', 'Organizaba los libros de la biblioteca de mi parroquia por temas y encontraba cualquiera rápido') },
    dismissed: [],
  };
  const { results } = await recommender.recommend(profile, { limit: 20 });
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.band !== 'alta'), 'solo una competencia declarada: ninguna banda alta');
  const almacen = results.find((r) => r.transferable.some((t) => t.id === 'org_productos'));
  assert.ok(almacen, 'aparece un empleo que requiere org_productos por transferencia');
  assert.ok(!almacen.matches.some((m) => m.id === 'org_productos'));
  console.log(`   ${almacen.name}: banda ${almacen.band}, cobertura ${almacen.ratio}, vía ${almacen.transferable.find((t) => t.id === 'org_productos').via}`);
});

test(`[QVAC real · ${MODEL}] caja con evidencia → empleos de caja arriba, con requisitos por verificar`, { skip }, async () => {
  const profile = {
    competencies: {
      manejo_dinero: comp('manejo_dinero', 'evidencia', 'Una vez la caja no cuadraba y revisé los vouchers uno por uno'),
      medios_pago: comp('medios_pago', 'declarada', 'Cobraba con Yape y verificaba que llegara el pago antes de entregar'),
      atencion_cliente: comp('atencion_cliente', 'declarada', 'Escuchaba con calma a los clientes que venían a reclamar'),
    },
    dismissed: [],
  };
  const { results } = await recommender.recommend(profile, { limit: 10 });
  console.log(`   ${results.slice(0, 5).map((r) => `${r.name} (${r.band})`).join(' · ')}`);
  assert.ok(['sint_cajero_supermercado', 'sint_agente_corresponsal', 'sint_supervisor_cajas'].includes(results[0].jobId));
  assert.ok(results.some((r) => r.pendingRequirements.length > 0 && r.pendingRequirements.every((p) => p.status === 'por_verificar')));
});

test(`[QVAC real · ${MODEL}] perfil guardado: un vector por evidencia y el endpoint usa PostgreSQL`, { skip }, async () => {
  const store = createProfileStore(pool);
  const p = ensureProfileId({ ...createEmptyProfile(), alias: 'Prueba embeddings', experience: { occupations: ['cajero'], formality: 'formal', duration: '1a3' } });
  profileId = p.profileId;
  const profile = {
    ...p,
    competencies: {
      manejo_dinero: comp('manejo_dinero', 'evidencia', 'Una vez la caja no cuadraba por 20 soles y revisé los vouchers uno por uno'),
      medios_pago: comp('medios_pago', 'declarada', 'Cobro en efectivo, con tarjeta y con Yape'),
    },
  };
  await store.save(profile);
  const indexer = createEmbeddingIndexer({ pool, embedder, profiles: store });
  const first = await indexer.indexProfile(profileId);
  assert.equal(first.ok, true);
  assert.equal((await indexer.indexProfile(profileId)).embedded, 0, 'sin cambios no se regenera');
  const { rows } = await pool.query(
    'SELECT ee.dim, ee.model, ee.model_version FROM evidence_embeddings ee JOIN competency_evidence e ON e.id = ee.evidence_id WHERE e.profile_id = $1',
    [profileId],
  );
  assert.ok(rows.length >= 2 && rows.every((r) => r.dim === 768 && r.model === MODEL && r.model_version === embedder.describe().modelVersion));

  const app = createApp({ llm: scriptedLlm([]), db: pool, recommender });
  const res = await app('POST', '/jobs/recommend', { profile, limit: 6 });
  const ids = (await pool.query('SELECT id FROM occupations WHERE is_synthetic')).rows.map((r) => r.id);
  assert.ok(res.length > 0 && res.every((r) => ids.includes(r.jobId) && r.synthetic && r.url === null));
});

test(`[QVAC real · ${MODEL}] sistema híbrido: evidencia → competencias candidatas → empleo pertinente en el top-5`, { skip }, async () => {
  let hits = 0;
  for (const c of JOB_CASES) {
    const [s] = await recommender.suggest([c.text]);
    const competencies = Object.fromEntries((s?.candidates || []).slice(0, 2).map((x) => [x.id, comp(x.id, 'declarada', c.text)]));
    const { results } = await recommender.recommend({ competencies, dismissed: [] }, { limit: 5 });
    const rank = results.findIndex((r) => c.expected.includes(r.jobId));
    if (rank >= 0) hits += 1;
    console.log(`   ${rank >= 0 ? `rango ${rank + 1}` : 'fuera'} · candidatas ${(s?.candidates || []).slice(0, 2).map((x) => x.id).join(',')} · «${c.text.slice(0, 45)}…»`);
  }
  console.log(`   híbrido top-5: ${hits}/${JOB_CASES.length}`);
  assert.ok(hits >= 6);
});

test(`[QVAC real · ${MODEL}] frases ambiguas como competencias «por validar» no producen recomendaciones fuertes`, { skip }, async () => {
  const competencies = {};
  for (const t of AMBIGUOUS) {
    const [s] = await recommender.suggest([t]);
    for (const c of s?.candidates || []) competencies[c.id] = comp(c.id, 'por_validar', t);
  }
  const { results } = await recommender.recommend({ competencies, dismissed: [] }, { limit: 10 });
  console.log(`   ${Object.keys(competencies).length} competencias por validar → bandas: ${[...new Set(results.map((r) => r.band))].join(', ') || 'ninguna'}`);
  assert.ok(results.every((r) => r.band !== 'alta'));
});
