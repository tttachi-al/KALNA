import { test } from 'node:test';
import assert from 'node:assert/strict';
import { close } from '@qvac/sdk';
import { createApp } from '../server/app.js';
import { createPool } from '../server/db/pool.js';
import { migrate } from '../server/db/migrate.js';
import { createProfileStore, ensureProfileId } from '../server/db/profiles.js';
import { createRecommender } from '../server/matching/recommend.js';
import { createSemanticIndex } from '../server/matching/semantic.js';
import { createQvacEmbedder } from '../server/qvac/embeddings.js';
import { createQvacLlm } from '../server/qvac/llm.js';
import { createRouteService } from '../server/route/service.js';
import { createPassportService } from '../server/passport/service.js';

test('pasaporte de valor profesional con QVAC y PostgreSQL reales', { skip: process.env.KALLPA_PASSPORT_LIVE !== '1' }, async () => {
  const pool = createPool(process.env.DATABASE_URL);
  const llm = createQvacLlm({ modelName: process.env.KALLPA_LLM_MODEL || 'QWEN3_4B_INST_Q4_K_M', timeoutMs: 120000 });
  const embedder = createQvacEmbedder();
  const profiles = createProfileStore(pool);
  const profile = ensureProfileId({ alias: 'Prueba pasaporte', experience: { occupations: ['cajero'], formality: 'informal', duration: '1a3' }, dismissed: [], competencies: {
    manejo_dinero: { id: 'manejo_dinero', status: 'evidencia', mentions: [], examples: [{ text: 'Al cerrar la tienda contaba los billetes y monedas y comparaba el total con las ventas del día.', level: 'fuerte' }] },
  } });
  try {
    await migrate(pool);
    await profiles.save(profile);
    await llm.load();
    await embedder.load();
    const recommender = createRecommender({ pool, semantic: createSemanticIndex({ pool, embedder }) });
    const { loadDestination } = createRouteService({ pool, llm, recommender });
    const passports = createPassportService({ pool, llm, embedder, recommender, loadDestination });
    const app = createApp({ llm, profiles, passports });
    const path = `/profile/${profile.profileId}/passports/cajero`;
    assert.equal(await app('GET', path), null);
    const passport = await app('POST', '/passport', { profileId: profile.profileId, occupationId: 'cajero' });
    assert.equal(passport.occupationId, 'cajero');
    assert.equal(passport.personalization.ok, true);
    assert.equal(passport.persistence.saved, true);
    assert.ok(passport.strengths.length);
    assert.ok(passport.pitch);
    assert.equal('stages' in passport, false);
    assert.equal('progress' in passport, false);
    assert.equal('total' in passport, false);
    const restarted = createPassportService({ pool, llm, embedder, recommender, loadDestination });
    assert.deepEqual((await restarted.get(profile.profileId, 'cajero')).pitch, passport.pitch);
    assert.equal(await restarted.get(profile.profileId, 'limpieza'), null);
    const limited = await passports.build({ ...profile, competencies: { manejo_dinero: { id: 'manejo_dinero', status: 'declarada', mentions: [{ quote: 'Trabajé de cajero.' }], examples: [] } } }, 'cajero');
    assert.equal(limited.presentation, null);
    assert.equal(limited.pitch, null);
    assert.ok(limited.questions.length);
    console.log(JSON.stringify({ model: llm.describe().model, embeddings: embedder.describe().model, target: passport.target.name, strengths: passport.strengths.length, inferred: passport.inferred.length, limitedQuestions: limited.questions.length, saved: true }));
  } finally {
    await pool.query('DELETE FROM job_profiles WHERE id = $1', [profile.profileId]);
    await embedder.close();
    await llm.close();
    await close();
    await pool.end();
  }
});
