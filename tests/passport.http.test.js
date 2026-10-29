import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../server/db/pool.js';
import { createProfileStore, ensureProfileId } from '../server/db/profiles.js';

test('HTTP real: recomendaciones → puesto seleccionado → pasaporte → recuperación', { skip: process.env.KALLPA_PASSPORT_HTTP !== '1' }, async () => {
  const pool = createPool(process.env.DATABASE_URL);
  const profiles = createProfileStore(pool);
  const c = (id, text) => ({ id, status: 'evidencia', mentions: [], examples: [{ text, level: 'fuerte' }] });
  const profile = ensureProfileId({ alias: 'Prueba HTTP pasaporte', experience: { occupations: ['cajero'], formality: 'informal', duration: '1a3' }, dismissed: [], competencies: {
    manejo_dinero: c('manejo_dinero', 'Ayer conté los billetes y monedas de la tienda y revisé el dinero al cerrar la caja.'),
    atencion_cliente: c('atencion_cliente', 'Una vez un cliente reclamó por su compra y escuché su problema antes de revisar el comprobante.'),
  } });
  const api = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:8000/api${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const value = await response.json();
    assert.equal(response.ok, true, JSON.stringify(value));
    return value;
  };
  try {
    await profiles.save(profile);
    const jobs = await api('/jobs/recommend', { profile, limit: 2 });
    assert.equal(jobs.length, 2);
    const passports = [];
    for (const job of jobs) {
      const path = `/profile/${profile.profileId}/passports/${job.jobId}`;
      assert.equal(await api(path), null);
      const passport = await api('/passport', { profileId: profile.profileId, occupationId: job.jobId });
      assert.equal(passport.target.name, job.name);
      assert.equal(passport.occupationId, job.jobId);
      assert.equal('stages' in passport, false);
      assert.equal('progress' in passport, false);
      assert.deepEqual(await api(path), passport);
      passports.push(passport.target.name);
    }
    console.log(JSON.stringify({ targets: passports, realHttp: true, qvac: true, persisted: true }));
  } finally {
    await pool.query('DELETE FROM job_profiles WHERE id = $1', [profile.profileId]);
    await pool.end();
  }
});
