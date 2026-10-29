import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoCase, kallpaService } from '../src/services/kallpaService.js';
import { buildDemoPassport } from '../src/services/engine/demoPassport.js';
import { recommendJobs } from '../src/services/engine/jobMatcher.js';

test('simulación presenta valor profesional del puesto sin generar una ruta ni llamar al backend', () => {
  const { profile } = buildDemoCase();
  assert.equal(profile.profileId, undefined);
  const jobs = recommendJobs(profile, 3);
  for (const job of jobs) {
    const p = kallpaService.createDemoPassport(profile, job.jobId);
    assert.equal(p.target.name, job.name);
    assert.equal(p.simulation, true);
    assert.equal(p.persistence.local, true);
    assert.equal(p.personalization.engine, 'reglas-locales');
    assert.ok(p.strengths.length || p.questions.length);
    assert.equal('stages' in p, false);
    assert.equal('progress' in p, false);
    assert.equal('total' in p, false);
  }
});

test('simulación omite competencias descartadas y rechaza puestos inexistentes', () => {
  const { profile } = buildDemoCase();
  assert.throws(() => buildDemoPassport(profile, 'no-existe'));
  const p = buildDemoPassport({ ...profile, dismissed: Object.keys(profile.competencies) }, 'cajero');
  assert.deepEqual(p.strengths, []);
  assert.deepEqual(p.inferred, []);
  assert.deepEqual(p.transferable, []);
});
