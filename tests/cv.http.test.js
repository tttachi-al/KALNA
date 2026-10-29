import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { createPool } from '../server/db/pool.js';
import { createProfileStore, ensureProfileId } from '../server/db/profiles.js';
import { buildDemoCase, kallpaService } from '../src/services/kallpaService.js';
import { recommendJobs } from '../src/services/engine/jobMatcher.js';

test('HTTP y QVAC reales: pasaporte existente → redacción → validación → descarga DOCX', { skip: process.env.KALLPA_CV_HTTP !== '1' }, async () => {
  const pool = createPool(process.env.DATABASE_URL);
  const profile = ensureProfileId({ alias: 'Prueba Word', experience: { occupations: ['cajero'], formality: 'informal' }, dismissed: [], competencies: {
    manejo_dinero: { id: 'manejo_dinero', status: 'evidencia', mentions: [], examples: [{ text: 'Ayer conté los billetes de la bodega y comparé el total con las ventas al cerrar la caja.', level: 'fuerte' }] },
  } });
  const request = (path, body, method = 'POST') => fetch(`http://127.0.0.1:8000/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const directory = new URL('../tmp/cv-qa/', import.meta.url);
  const checkFile = async (response, filename) => {
    if (!response.ok) assert.fail(await response.text());
    assert.match(response.headers.get('Content-Type'), /wordprocessingml/);
    assert.match(response.headers.get('Content-Disposition'), /attachment; filename="CV_/);
    const buffer = Buffer.from(await response.arrayBuffer());
    const xml = strFromU8(unzipSync(buffer)['word/document.xml']);
    for (const text of ['PERFIL PROFESIONAL', 'EXPERIENCIA LABORAL', 'CERTIFICACIONES', 'IDIOMAS']) assert.ok(xml.includes(text));
    assert.ok(!xml.includes('sourceIds') && !xml.includes('QVAC') && !xml.includes('Prioridad alta'));
    await writeFile(new URL(filename, directory), buffer);
    return xml;
  };
  try {
    await mkdir(directory, { recursive: true });
    for (let i = 0; i < 30; i++) {
      const health = await (await fetch('http://127.0.0.1:8000/api/health')).json();
      if (health.llm?.status === 'ready' && health.embeddings?.status === 'ready') break;
      if (i === 29) assert.fail('Los modelos todavía no están disponibles.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await createProfileStore(pool).save(profile);
    const p = await request('/passport', { profileId: profile.profileId, occupationId: 'cajero' });
    assert.equal(p.ok, true, await p.text());
    const response = await request('/cv/word', { profileId: profile.profileId, occupationId: 'cajero', draft: {
      contact: { fullName: 'Prueba Word', email: 'prueba@example.test' }, education: [{ institution: 'Institución declarada', qualification: 'Secundaria completa', period: '2019' }],
    } });
    const xml = await checkFile(response, 'CV_QVAC_Real.docx');
    assert.ok(xml.includes('prueba@example.test') && xml.includes('Institución declarada'));
    const { rows: [saved] } = await pool.query('SELECT data FROM profile_cv WHERE profile_id = $1', [profile.profileId]);
    assert.equal(saved.data.contact.email, 'prueba@example.test');
    const { profile: demo } = buildDemoCase();
    const job = recommendJobs(demo, 1)[0];
    const passport = kallpaService.createDemoPassport(demo, job.jobId);
    await checkFile(await request('/cv/word', { mode: 'simulation', profile: demo, passport, occupationId: job.jobId }), 'CV_Simulacion_QVAC.docx');
    console.log(JSON.stringify({ realQvac: true, docxDownloaded: true, normalAndSimulation: true, metadataPreserved: true }));
  } finally {
    await pool.query('DELETE FROM job_profiles WHERE id = $1', [profile.profileId]);
    await pool.end();
  }
});
