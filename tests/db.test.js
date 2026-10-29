// Esquema de PostgreSQL REAL (npm run test:db, requiere DATABASE_URL).
//
// Aplica las migraciones y comprueba el esquema. Las pruebas que escriben
// datos lo hacen dentro de una transacción que se revierte o borran al final
// SOLO los perfiles que crearon (por su id).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { COMPETENCIES } from '../src/data/competencies.js';
import { createEmptyProfile } from '../src/services/engine/profile.js';
import { createApp } from '../server/app.js';
import { syncCatalog } from '../server/db/catalog.js';
import { listMigrations, migrate } from '../server/db/migrate.js';
import { createPool } from '../server/db/pool.js';
import { createProfileStore, ensureProfileId } from '../server/db/profiles.js';
import { createEmbeddingIndexer } from '../server/embeddings/indexer.js';
import { createRecommender } from '../server/matching/recommend.js';
import { createSemanticIndex } from '../server/matching/semantic.js';
import { fakeEmbedder } from './helpers/embedder.js';
import { BASICS, notes, ques, scriptedLlm } from './helpers/conversation.js';

const url = process.env.DATABASE_URL;
const skip = url ? false : 'Define DATABASE_URL en .env para probar contra PostgreSQL.';
const pool = createPool(url);

const createdProfiles = new Set();

before(async () => {
  if (!pool) return;
  await migrate(pool);
  await syncCatalog(pool);
});

after(async () => {
  if (!pool) return;
  if (createdProfiles.size) await pool.query('DELETE FROM job_profiles WHERE id = ANY($1::uuid[])', [[...createdProfiles]]);
  await pool.end();
});

const tables = async () =>
  (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")).rows.map((r) => r.table_name);

/** Ejecuta `fn` en una transacción que siempre se revierte. */
async function inRollback(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

/** Ejecuta una sentencia que debe fallar sin abortar la transacción de prueba. */
async function rejects(client, sql, params, pattern) {
  await client.query('SAVEPOINT s');
  await assert.rejects(client.query(sql, params), pattern);
  await client.query('ROLLBACK TO SAVEPOINT s');
}

test('las migraciones quedan registradas y son idempotentes', { skip }, async () => {
  assert.deepEqual(await migrate(pool), [], 'una segunda ejecución no aplica nada');
  const { rows } = await pool.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
  const files = await listMigrations();
  const applied = new Map(rows.map((r) => [r.version, r.checksum]));
  // Cada archivo está aplicado y sin cambios.
  for (const f of files) assert.equal(applied.get(f.version), f.checksum, `migración ${f.name}`);
  // La 009 (009_routes_and_cv.sql) se aplicó en desarrollo pero su archivo falta; la 010 recrea sus tablas.
  const withoutFile = rows.map((r) => r.version).filter((v) => !files.some((f) => f.version === v));
  assert.ok(withoutFile.every((v) => v === 9), `versiones aplicadas sin archivo: ${withoutFile.join(', ')}`);
});

test('ya no existen las tablas de transcripciones y sí el esquema de empleabilidad', { skip }, async () => {
  const t = await tables();
  assert.ok(!t.includes('conversations'));
  assert.ok(!t.includes('conversation_messages'));
  for (const name of [
    'schema_migrations',
    'competency_families',
    'competencies',
    'occupations',
    'occupation_competencies',
    'job_profiles',
    'profile_competencies',
    'competency_evidence',
    'competency_embeddings',
    'occupation_embeddings',
  ]) {
    assert.ok(t.includes(name), `falta la tabla ${name}`);
  }
});

test('perfil, competencias, evidencias y embeddings se pueden guardar y leer (con reversión)', { skip }, async () => {
  await inRollback(async (c) => {
    await c.query("INSERT INTO competency_families (id, name) VALUES ('t_fam', 'Familia de prueba')");
    await c.query("INSERT INTO competencies (id, family_id, name, description) VALUES ('t_comp', 't_fam', 'Competencia de prueba', 'Revisa y repone insumos.')");
    await c.query("INSERT INTO occupations (id, name, summary, scope) VALUES ('t_occ', 'Ocupación de prueba', 'Resumen.', 'reference')");
    await c.query("INSERT INTO occupation_competencies VALUES ('t_occ', 't_comp', 'clave')");

    const { rows: [p] } = await c.query("INSERT INTO job_profiles (alias, occupations, formality, duration) VALUES ('Prueba', '{t_occ}', 'formal', '1a3') RETURNING id");
    await c.query("INSERT INTO profile_competencies (profile_id, competency_id, status) VALUES ($1, 't_comp', 'declarada')", [p.id]);
    await c.query(
      "INSERT INTO competency_evidence (profile_id, competency_id, kind, quote, source) VALUES ($1, 't_comp', 'mencion', 'reviso qué insumos faltan', 'entrevista')",
      [p.id],
    );

    // El nivel solo se admite cuando la competencia tiene evidencia.
    await rejects(c, "UPDATE profile_competencies SET level = 'basico' WHERE profile_id = $1", [p.id], /level_requires_evidence/);
    await c.query("UPDATE profile_competencies SET status = 'evidencia', level = 'basico' WHERE profile_id = $1", [p.id]);
    await rejects(c, "UPDATE profile_competencies SET status = 'otro' WHERE profile_id = $1", [p.id], /check/i);

    // Texto y vector juntos; la dimensión declarada debe coincidir con el vector.
    await c.query(
      "INSERT INTO competency_embeddings (competency_id, text_kind, text, text_hash, model, dim, embedding) VALUES ('t_comp', 'descripcion', 'Revisa y repone insumos.', 'h1', 'TEST', 3, '[1,0,0]')",
    );
    await rejects(
      c,
      "INSERT INTO competency_embeddings (competency_id, text_kind, text, text_hash, model, dim, embedding) VALUES ('t_comp', 'ejemplo', 'x', 'h2', 'TEST', 4, '[1,0,0]')",
      [],
      /competency_embedding_dim/,
    );
    await c.query(
      "INSERT INTO occupation_embeddings (occupation_id, text_kind, text, text_hash, model, dim, embedding) VALUES ('t_occ', 'descripcion', 'Resumen.', 'h1', 'TEST', 3, '[0,1,0]')",
    );

    const { rows: [row] } = await c.query(
      `SELECT pc.status, pc.level, e.quote, ce.text, ce.embedding <=> '[1,0,0]' AS distancia
       FROM profile_competencies pc
       JOIN competency_evidence e USING (profile_id, competency_id)
       JOIN competency_embeddings ce USING (competency_id)
       WHERE pc.profile_id = $1`,
      [p.id],
    );
    assert.deepEqual({ ...row, distancia: Number(row.distancia) }, { status: 'evidencia', level: 'basico', quote: 'reviso qué insumos faltan', text: 'Revisa y repone insumos.', distancia: 0 });

    // Borrar el perfil borra sus competencias y evidencias, no el catálogo.
    await c.query('DELETE FROM job_profiles WHERE id = $1', [p.id]);
    const { rows: [n] } = await c.query(
      "SELECT (SELECT count(*) FROM profile_competencies WHERE profile_id = $1)::int pc, (SELECT count(*) FROM competency_evidence WHERE profile_id = $1)::int ev, (SELECT count(*) FROM competencies WHERE id = 't_comp')::int comp",
      [p.id],
    );
    assert.deepEqual(n, { pc: 0, ev: 0, comp: 1 });
  });
  const { rows } = await pool.query("SELECT count(*)::int n FROM competencies WHERE id = 't_comp'");
  assert.equal(rows[0].n, 0, 'la reversión no dejó datos de prueba');
});

test('el chat funciona con la base conectada y no escribe en ella', { skip }, async () => {
  const count = async () => (await pool.query('SELECT sum(n_tup_ins)::int n FROM pg_stat_user_tables')).rows[0].n;
  const before = await count();
  const app = createApp({ llm: scriptedLlm([]), db: pool, profiles: createProfileStore(pool) });
  assert.equal((await app('GET', '/health', null)).db.status, 'ready');
  let r = await app('POST', '/diagnosis/start', null);
  for (const input of BASICS.slice(0, 4)) r = await app('POST', `/diagnosis/${r.session.id}/answer`, { input });
  assert.equal(r.session.stage, 'tiempo');
  assert.equal(await count(), before, 'no hubo inserciones');
});

/* ───────── Perfil con competencias (análisis de QVAC simulado) ───────── */

const QUOTE_EV = 'El lunes encontré yogures vencidos, los retiré del anaquel y avisé al supervisor';
function sampleProfile() {
  const p = ensureProfileId({ ...createEmptyProfile(), alias: 'Prueba BD', experience: { occupations: ['reponedor'], formality: 'formal', duration: '1a3' } });
  createdProfiles.add(p.profileId);
  return {
    ...p,
    competencies: {
      control_existencias: {
        id: 'control_existencias',
        status: 'evidencia',
        level: 'intermedio',
        levelReason: 'Detectó productos vencidos y avisó.',
        mentions: [{ quote: QUOTE_EV, source: 'entrevista', origin: 'qvac', type: 'ejemplo_concreto' }],
        examples: [{ text: QUOTE_EV, level: 'fuerte', at: '2026-10-27T00:00:00.000Z', source: 'entrevista' }],
      },
      reposicion: { id: 'reposicion', status: 'declarada', mentions: [{ quote: 'Repongo los anaqueles', source: 'tareas' }], examples: [] },
    },
    analysis: { engine: 'qvac', model: 'TEST', promptVersion: 'v1', ok: true, at: '2026-10-27T00:00:00.000Z', missingInformation: ['Cómo registra lo que retira'], ids: ['control_existencias'] },
  };
}

test('el catálogo de competencias está en la base (lo referencian los perfiles)', { skip }, async () => {
  const { rows } = await pool.query("SELECT id FROM competencies WHERE validation = 'demo' ORDER BY id");
  for (const id of Object.keys(COMPETENCIES)) assert.ok(rows.some((r) => r.id === id), `falta ${id}`);
});

test('guarda y recupera un perfil con competencias, estados, nivel y evidencias', { skip }, async () => {
  const store = createProfileStore(pool);
  const p = sampleProfile();
  await store.save(p);
  const got = await store.load(p.profileId);
  assert.equal(got.alias, 'Prueba BD');
  assert.deepEqual(got.analysis.missingInformation, ['Cómo registra lo que retira']);
  const ce = got.competencies.find((c) => c.id === 'control_existencias');
  assert.deepEqual([ce.status, ce.level, ce.name], ['evidencia', 'intermedio', COMPETENCIES.control_existencias.name]);
  assert.deepEqual(ce.evidence.map((e) => [e.kind, e.origin, e.type]), [['mencion', 'qvac', 'ejemplo_concreto'], ['ejemplo', 'qvac', 'ejemplo_concreto']]);
  const rp = got.competencies.find((c) => c.id === 'reposicion');
  assert.deepEqual([rp.status, rp.level, rp.evidence[0].origin], ['declarada', null, 'reglas']);
});

test('volver a generar el perfil no duplica competencias ni evidencias, y marca lo descartado', { skip }, async () => {
  const store = createProfileStore(pool);
  const p = sampleProfile();
  await store.save(p);
  const again = await store.save(p);
  assert.equal(again.newEvidence, 0);
  const { reposicion, ...rest } = p.competencies;
  assert.ok(reposicion);
  await store.save({ ...p, competencies: rest, dismissed: ['reposicion'] });
  const { rows } = await pool.query(
    'SELECT competency_id, dismissed, (SELECT count(*)::int FROM competency_evidence e WHERE e.profile_id = pc.profile_id AND e.competency_id = pc.competency_id) n FROM profile_competencies pc WHERE profile_id = $1 ORDER BY 1',
    [p.profileId],
  );
  assert.deepEqual(rows, [
    { competency_id: 'control_existencias', dismissed: false, n: 2 },
    { competency_id: 'reposicion', dismissed: true, n: 1 },
  ]);
});

test('un dato inválido hace fallar el guardado entero (sin guardados parciales)', { skip }, async () => {
  const store = createProfileStore(pool);
  const p = sampleProfile();
  const bad = { ...p, competencies: { ...p.competencies, reposicion: { ...p.competencies.reposicion, status: 'otro' } } };
  await assert.rejects(store.save(bad), /check/i);
  assert.equal(await store.load(p.profileId), null, 'la transacción se revirtió entera');
});

test('API con PostgreSQL: al generar el perfil se guarda y se recupera; no hay transcripciones', { skip }, async () => {
  const good = JSON.stringify({
    competencies: [{ id: 'control_existencias', status: 'evidencia', evidence: [{ quote: QUOTE_EV, type: 'ejemplo_concreto' }], level: 'sin_nivel', level_reason: '' }],
    missing_information: ['Cómo registra lo que retira'],
  });
  const llm = scriptedLlm([ques('¿Cómo aprendiste?', { area: 'antes' }), notes(), ques('¿Qué pasó?'), notes(), ques('¿Y después?'), good]);
  const app = createApp({ llm, db: pool, profiles: createProfileStore(pool) });
  let r = await app('POST', '/diagnosis/start', null);
  const id = r.session.id;
  for (const input of [...BASICS, { text: 'Repongo los anaqueles de abarrotes cada mañana.' }, { text: `${QUOTE_EV}.` }]) {
    r = await app('POST', `/diagnosis/${id}/answer`, { input });
  }
  r = await app('POST', `/diagnosis/${id}/answer`, { input: { skip: true } });
  assert.equal(r.persistence.saved, true);
  createdProfiles.add(r.persistence.profileId);
  const got = await app('GET', `/profile/${r.persistence.profileId}`, null);
  assert.equal(got.competencies.find((c) => c.id === 'control_existencias').status, 'evidencia');
  const t = await tables();
  assert.ok(!t.some((n) => /conversation|message/.test(n)), 'no existen tablas de conversaciones ni mensajes');
});

/* ───────── Embeddings en pgvector (embedder simulado y determinista) ───────── */

async function profileForEmbeddings(extra = {}) {
  const store = createProfileStore(pool);
  const p = { ...sampleProfile(), ...extra };
  await store.save(p);
  return { store, p };
}
const evRows = (id) =>
  pool
    .query(
      `SELECT e.competency_id, ee.text, ee.text_hash, ee.model, ee.model_version, ee.input_format, ee.dim, ee.embedding::text AS v
       FROM evidence_embeddings ee JOIN competency_evidence e ON e.id = ee.evidence_id WHERE e.profile_id = $1 ORDER BY e.id`,
      [id],
    )
    .then((r) => r.rows);
const statuses = (id) =>
  pool.query('SELECT competency_id, embedding_status, embedding_error FROM profile_competencies WHERE profile_id = $1 ORDER BY competency_id', [id]).then((r) => r.rows);
const cleanTestVectors = () =>
  Promise.all([pool.query("DELETE FROM competency_embeddings WHERE model = 'TEST_EMBED'"), pool.query("DELETE FROM occupation_embeddings WHERE model = 'TEST_EMBED'")]);

test('referencias de competencias: descripción + indicadores + ejemplos; reindexar no duplica', { skip }, async () => {
  const indexer = createEmbeddingIndexer({ pool, embedder: fakeEmbedder(), profiles: createProfileStore(pool) });
  try {
    const first = await indexer.indexCatalog();
    const again = await indexer.indexCatalog();
    assert.equal(again.embedded, 0);
    const { rows } = await pool.query(
      "SELECT competency_id, count(*)::int n, count(DISTINCT (text_kind, chunk))::int k FROM competency_embeddings WHERE model = 'TEST_EMBED' GROUP BY 1",
    );
    assert.equal(rows.length, Object.keys(COMPETENCIES).length);
    assert.ok(rows.every((r) => r.n === r.k && r.n === 8), 'descripción + 3 indicadores + 4 ejemplos, sin duplicados');
    assert.equal(first.embedded + first.unchanged, 160);
  } finally {
    await cleanTestVectors();
  }
});

test('empleos: vector general + uno por tarea de cada empleo sintético; reindexar no duplica', { skip }, async () => {
  const indexer = createEmbeddingIndexer({ pool, embedder: fakeEmbedder(), profiles: createProfileStore(pool) });
  try {
    const r = await indexer.indexOccupations();
    assert.equal(r.occupations, 50);
    assert.equal((await indexer.indexOccupations()).embedded, 0);
    const { rows: [c] } = await pool.query(
      `SELECT count(DISTINCT oe.occupation_id)::int empleos, count(*) FILTER (WHERE text_kind = 'descripcion')::int generales,
              count(*) FILTER (WHERE text_kind = 'tareas')::int tareas,
              (SELECT sum(cardinality(tasks))::int FROM occupations WHERE is_synthetic) esperadas,
              count(*) FILTER (WHERE NOT o.is_synthetic)::int no_sinteticos
       FROM occupation_embeddings oe JOIN occupations o ON o.id = oe.occupation_id WHERE oe.model = 'TEST_EMBED'`,
    );
    assert.deepEqual(c, { empleos: 50, generales: 50, tareas: c.esperadas, esperadas: c.esperadas, no_sinteticos: 0 });
  } finally {
    await cleanTestVectors();
  }
});

test('evidencias: un vector por cita (texto, modelo, formato, fecha), recuperado intacto y sin duplicar', { skip }, async () => {
  const { store, p } = await profileForEmbeddings();
  const indexer = createEmbeddingIndexer({ pool, embedder: fakeEmbedder(), profiles: store });
  const r = await indexer.indexProfile(p.profileId);
  const { rows: [{ n }] } = await pool.query('SELECT count(*)::int n FROM competency_evidence WHERE profile_id = $1', [p.profileId]);
  assert.deepEqual([r.ok, r.embedded, r.dim], [true, n, 8]);
  const rows = await evRows(p.profileId);
  assert.equal(rows.length, n);
  assert.ok(rows.every((x) => x.model === 'TEST_EMBED' && x.model_version === 'test-v1' && x.input_format === 'retrieval_query' && x.dim === 8));
  const expected = (await fakeEmbedder().embed([`task: search result | query: ${rows[0].text}`])).vectors[0];
  JSON.parse(rows[0].v).forEach((x, i) => assert.ok(Math.abs(x - expected[i]) < 1e-6, `valor ${i}`));

  const again = await indexer.indexProfile(p.profileId);
  assert.deepEqual([again.embedded, again.unchanged], [0, n], 'sin cambios no se regenera');
  assert.equal((await evRows(p.profileId)).length, n);
  assert.ok((await statuses(p.profileId)).every((s) => s.embedding_status === 'generado'));
});

test('evidencias: las de competencias descartadas no se embeben', { skip }, async () => {
  const { store, p } = await profileForEmbeddings();
  const { reposicion, ...rest } = p.competencies;
  assert.ok(reposicion);
  await store.save({ ...p, competencies: rest, dismissed: ['reposicion'] });
  await createEmbeddingIndexer({ pool, embedder: fakeEmbedder(), profiles: store }).indexProfile(p.profileId);
  assert.ok(!(await evRows(p.profileId)).some((x) => x.competency_id === 'reposicion'));
});

test('si falla la generación: no hay vectores, queda «error» con el motivo y se puede reintentar', { skip }, async () => {
  const { store, p } = await profileForEmbeddings();
  const failing = createEmbeddingIndexer({ pool, embedder: fakeEmbedder({ fail: new Error('QVAC no generó los embeddings en 60 s.') }), profiles: store, log: () => {} });
  const r = await failing.schedule(p.profileId);
  assert.equal(r.ok, false);
  assert.match(r.error, /Generación/);
  assert.equal((await evRows(p.profileId)).length, 0);
  assert.ok((await statuses(p.profileId)).every((s) => s.embedding_status === 'error' && /60 s/.test(s.embedding_error)));
  // Acotado a este perfil: la prueba no debe tocar perfiles reales de la base.
  const retried = await createEmbeddingIndexer({ pool, embedder: fakeEmbedder(), profiles: store }).retryPending({ profileIds: [p.profileId] });
  assert.ok(retried.some((x) => x.ok && x.embedded > 0));
  assert.ok((await statuses(p.profileId)).every((s) => s.embedding_status === 'generado' && s.embedding_error === null));
});

test('si falla el almacenamiento: transacción revertida, ningún «generado» y error registrado', { skip }, async () => {
  const { store, p } = await profileForEmbeddings();
  // Declara 8 dimensiones pero entrega 4: la restricción de pgvector lo rechaza.
  const bad = fakeEmbedder({ raw: (texts) => texts.map(() => [0.5, 0.5, 0.5, 0.5]) });
  const r = await createEmbeddingIndexer({ pool, embedder: bad, profiles: store, log: () => {} }).indexProfile(p.profileId);
  assert.equal(r.ok, false);
  assert.match(r.error, /Almacenamiento/);
  assert.equal((await evRows(p.profileId)).length, 0);
  assert.ok((await statuses(p.profileId)).every((s) => s.embedding_status === 'error'));
});

test('pgvector rechaza vectores con valores no finitos', { skip }, async () => {
  await assert.rejects(pool.query("SELECT '[1,NaN,2]'::vector"), /NaN/i);
  await assert.rejects(pool.query("SELECT '[1,Infinity,2]'::vector"), /infinite/i);
});

/* ───────── Recomendaciones con PostgreSQL (embedder simulado) ───────── */

test('POST /jobs/recommend usa los empleos sintéticos de PostgreSQL y respeta los descartes', { skip }, async () => {
  const emb = fakeEmbedder();
  const indexer = createEmbeddingIndexer({ pool, embedder: emb, profiles: createProfileStore(pool) });
  try {
    await indexer.indexCatalog();
    await indexer.indexOccupations();
    const recommender = createRecommender({ pool, semantic: createSemanticIndex({ pool, embedder: emb }) });
    const app = createApp({ llm: scriptedLlm([]), db: pool, recommender });
    const comp = (id, status, quote) => ({ id, status, mentions: [{ quote, source: 'entrevista' }], examples: status === 'evidencia' ? [{ text: quote, level: 'fuerte' }] : [] });
    const profile = {
      competencies: {
        manejo_dinero: comp('manejo_dinero', 'evidencia', 'Una vez la caja no cuadraba y revisé los vouchers'),
        medios_pago: comp('medios_pago', 'declarada', 'Cobraba con Yape y tarjeta'),
        atencion_cliente: comp('atencion_cliente', 'declarada', 'Atendía con paciencia a los clientes'),
      },
      dismissed: [],
    };
    const res = await app('POST', '/jobs/recommend', { profile, limit: 10 });
    assert.ok(res.length > 0);
    const { JOBS } = await import('../src/data/jobs.js');
    const legacy = new Set(JOBS.map((j) => j.id));
    assert.ok(res.every((r) => r.jobId.startsWith('sint_') && !legacy.has(r.jobId) && r.synthetic === true && r.url === null), 'solo empleos sintéticos de PostgreSQL, sin enlaces');
    const ids = (await pool.query('SELECT id FROM occupations WHERE is_synthetic')).rows.map((r) => r.id);
    assert.ok(res.every((r) => ids.includes(r.jobId)));
    assert.ok(res.every((r) => ['alta', 'media', 'exploratoria'].includes(r.band)));

    // Descartar manejo_dinero: no se usa ni como coincidencia ni como base de transferencia.
    const without = await app('POST', '/jobs/recommend', { profile: { ...profile, dismissed: ['manejo_dinero'] }, limit: 10 });
    assert.ok(without.every((r) => !r.matches.some((m) => m.id === 'manejo_dinero') && !r.transferable.some((t) => t.from.id === 'manejo_dinero')));
    // Sin competencias no se recomienda nada.
    assert.deepEqual(await app('POST', '/jobs/recommend', { profile: { competencies: {}, dismissed: [] } }), []);
  } finally {
    await cleanTestVectors();
  }
});

test('PUT /profile guarda las competencias descartadas en PostgreSQL', { skip }, async () => {
  const { store, p } = await profileForEmbeddings();
  const app = createApp({ llm: scriptedLlm([]), db: pool, profiles: store });
  const { reposicion, ...rest } = p.competencies;
  assert.ok(reposicion);
  const r = await app('PUT', '/profile', { profile: { ...p, competencies: rest, dismissed: ['reposicion'] } });
  assert.equal(r.persistence.saved, true);
  const got = await store.load(p.profileId);
  assert.equal(got.competencies.find((c) => c.id === 'reposicion').dismissed, true);
});

/* ───────── Catálogo sintético de empleos (colección plana) ───────── */

test('catálogo sintético: exactamente 50 empleos únicos con relaciones válidas; recargarlo no duplica nada', { skip }, async () => {
  const { loadSyntheticCatalog } = await import('../server/catalog/load.js');
  const counts = async () =>
    (
      await pool.query(`SELECT
      (SELECT count(*) FROM occupations WHERE is_synthetic)::int empleos,
      (SELECT count(DISTINCT lower(name)) FROM occupations WHERE is_synthetic)::int nombres,
      (SELECT count(*) FROM occupation_competencies oc JOIN occupations o ON o.id = oc.occupation_id WHERE o.is_synthetic)::int competencias,
      (SELECT count(*) FROM occupation_requirements r JOIN occupations o ON o.id = r.occupation_id WHERE o.is_synthetic)::int requisitos,
      (SELECT count(*) FROM occupation_competencies oc WHERE NOT EXISTS (SELECT 1 FROM occupations o WHERE o.id = oc.occupation_id))::int huerfanas,
      (SELECT count(*) FROM occupations o WHERE o.is_synthetic AND NOT EXISTS (SELECT 1 FROM occupation_competencies c WHERE c.occupation_id = o.id AND c.weight = 'clave'))::int sin_clave`)
    ).rows[0];
  await loadSyntheticCatalog(pool);
  const first = await counts();
  await loadSyntheticCatalog(pool);
  assert.deepEqual(await counts(), first, 'la segunda carga no inserta registros nuevos');
  assert.equal(first.empleos, 50);
  assert.equal(first.nombres, 50);
  assert.equal(first.huerfanas, 0);
  assert.equal(first.sin_clave, 0);
  const { rows: [s] } = await pool.query("SELECT count(*) FILTER (WHERE scope <> 'synthetic' OR catalog_version <> 'sintetico-v2')::int mal FROM occupations WHERE is_synthetic");
  assert.equal(s.mal, 0, 'todos los empleos sintéticos están marcados con su versión');
});

test('catálogo sintético: ya no existen tablas de agrupación por perfiles', { skip }, async () => {
  const t = await tables();
  assert.ok(!t.some((n) => n.startsWith('origin_profile')), t.join(', '));
  await inRollback(async (c) => {
    await rejects(c, "INSERT INTO occupations (id, name, summary, scope, is_synthetic) VALUES ('t_x', 'X', 'Y', 'synthetic', false)", [], /synthetic_consistency/);
  });
});

/* ───────── Rutas laborales (employability_routes) ───────── */

test('ruta: se guarda, se reutiliza sin volver a llamar al modelo y conserva el progreso', { skip }, async () => {
  const { createRouteService } = await import('../server/route/service.js');
  const { evaluateJob } = await import('../server/matching/compatibility.js');
  const { p } = await profileForEmbeddings();
  const toOwn = (profile) =>
    new Map(Object.values(profile.competencies).filter((c) => !(profile.dismissed || []).includes(c.id)).map((c) => [c.id, { status: c.status, quotes: c.mentions.map((m) => m.quote) }]));
  const recommender = { compare: async (profile, job) => ({ result: evaluateJob({ job, own: toOwn(profile) }) }) };
  const llm = { calls: 0, async generate() { this.calls += 1; throw Object.assign(new Error('sin modelo en la prueba'), { retryable: true }); } };
  const routes = createRouteService({ pool, recommender, llm });
  const app = createApp({ llm: scriptedLlm([]), db: pool, routes });

  const r1 = await app('POST', '/route', { profile: p, occupationId: 'sint_auxiliar_almacen' });
  assert.equal(r1.occupationId, 'sint_auxiliar_almacen');
  assert.equal(r1.target.name, 'Auxiliar de almacén');
  assert.equal(r1.persistence.saved, true);
  assert.equal(llm.calls, 1);
  const { rows: [row] } = await pool.query('SELECT route, progress FROM employability_routes WHERE profile_id = $1 AND occupation_id = $2', [p.profileId, 'sint_auxiliar_almacen']);
  assert.equal(row.route.total, r1.total);

  const ids = r1.stages.flatMap((s) => s.items.map((i) => i.id));
  const saved = await app('PUT', `/profile/${p.profileId}/routes/sint_auxiliar_almacen/progress`, { progress: { [ids[0]]: true, inventado: true } });
  assert.deepEqual(saved.progress, { [ids[0]]: true }, 'solo ids de la ruta');

  const r2 = await app('POST', '/route', { profile: p, occupationId: 'sint_auxiliar_almacen' });
  assert.equal(llm.calls, 1, 'sin cambios: se reutiliza la ruta guardada');
  assert.deepEqual(r2.progress, { [ids[0]]: true }, 'el progreso persiste');

  // Cambia el perfil: se regenera, y el progreso de las actividades que siguen se conserva.
  const changed = { ...p, competencies: { ...p.competencies, control_existencias: { ...p.competencies.control_existencias, status: 'declarada' } } };
  const r3 = await app('POST', '/route', { profile: changed, occupationId: 'sint_auxiliar_almacen' });
  assert.equal(llm.calls, 2);
  const ids3 = new Set(r3.stages.flatMap((s) => s.items.map((i) => i.id)));
  assert.deepEqual(r3.progress, ids3.has(ids[0]) ? { [ids[0]]: true } : {});

  // Otro destino: otra ruta, sin mezclar actividades.
  const other = await app('POST', '/route', { profile: p, occupationId: 'sint_limpieza_oficinas' });
  assert.equal(other.occupationId, 'sint_limpieza_oficinas');
  assert.ok(!JSON.stringify(other.stages).includes('Auxiliar de almacén'));
  const list = await app('GET', `/profile/${p.profileId}/routes`, null);
  assert.deepEqual(list.map((x) => x.occupationId).sort(), ['sint_auxiliar_almacen', 'sint_limpieza_oficinas']);

  await assert.rejects(app('POST', '/route', { profile: p, occupationId: 'sint_no_existe' }), (e) => e.status === 404);
  await assert.rejects(app('PUT', `/profile/${p.profileId}/routes/sint_no_existe/progress`, { progress: {} }), (e) => e.status === 404);
});
