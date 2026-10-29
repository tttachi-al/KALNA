// Cuentas contra PostgreSQL REAL (requiere DATABASE_URL):
//   node --env-file-if-exists=.env --test tests/accounts.db.test.js
// Crea sus propias cuentas y perfiles de prueba y los elimina al final.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuthService } from '../server/auth/service.js';
import { createAssessmentDbStore } from '../server/assessment/store.js';
import { migrate } from '../server/db/migrate.js';
import { createPool } from '../server/db/pool.js';

const url = process.env.DATABASE_URL;
const skip = url ? false : 'Define DATABASE_URL en .env para probar contra PostgreSQL.';
const pool = createPool(url);
const tag = randomUUID().slice(0, 8);
const emails = [`prueba-a-${tag}@kallpa.test`, `prueba-b-${tag}@kallpa.test`];
const profiles = [randomUUID(), randomUUID(), randomUUID()];

before(async () => {
  if (!pool) return;
  await migrate(pool);
  for (const id of profiles) await pool.query("INSERT INTO job_profiles (id, alias, occupations) VALUES ($1, 'Prueba cuentas', '{limpieza}')", [id]);
  await pool.query("INSERT INTO profile_competencies (profile_id, competency_id, status) VALUES ($1, 'protocolos', 'declarada')", [profiles[0]]);
  await createAssessmentDbStore(pool).save({ id: randomUUID(), profileId: profiles[0], status: 'completada', items: [] });
});

after(async () => {
  if (!pool) return;
  await pool.query('DELETE FROM job_profiles WHERE id = ANY($1)', [profiles]);
  await pool.query('DELETE FROM user_accounts WHERE email = ANY($1)', [emails]);
  await pool.end();
});

const count = async (sql, params) => (await pool.query(sql, params)).rows[0].n;

test('registro, sesión, vínculo del perfil y eliminación solo de la propia cuenta', { skip }, async () => {
  const auth = createAuthService({ pool });
  const a = await auth.register({ email: emails[0].toUpperCase(), password: 'clave-segura-a', profileId: profiles[0] });
  assert.equal(a.user.email, emails[0]);
  assert.deepEqual(a.user.profileIds, [profiles[0]]);
  await assert.rejects(auth.register({ email: emails[0], password: 'otra-clave-123' }), (e) => e.status === 409);
  await assert.rejects(auth.register({ email: 'no-es-correo', password: 'clave-segura-a' }), (e) => e.status === 400);
  await assert.rejects(auth.register({ email: emails[1], password: 'corta' }), (e) => e.status === 400);

  // B no puede quedarse con el perfil de A; sí con uno libre.
  const b = await auth.register({ email: emails[1], password: 'clave-segura-b', profileId: profiles[0] });
  assert.deepEqual(b.user.profileIds, []);
  const bLogin = await auth.login({ email: emails[1], password: 'clave-segura-b', profileId: profiles[1] });
  assert.deepEqual(bLogin.user.profileIds, [profiles[1]]);
  await assert.rejects(auth.login({ email: emails[1], password: 'equivocada' }), (e) => e.status === 401);

  // La base guarda el hash de la sesión, no el token.
  assert.equal(await count('SELECT count(*)::int n FROM account_sessions WHERE token_hash = $1', [a.session.token]), 0);
  const userA = await auth.userFromToken(a.session.token);
  const userB = await auth.userFromToken(b.session.token);
  assert.equal(userA.email, emails[0]);

  // Contraseña incorrecta o sin confirmación: no se borra nada.
  await assert.rejects(auth.deleteAccount(userA, { password: 'clave-segura-b', confirmation: 'ELIMINAR' }), (e) => e.status === 401);
  await assert.rejects(auth.deleteAccount(userA, { password: 'clave-segura-a' }), (e) => e.status === 400);
  assert.equal(await count('SELECT count(*)::int n FROM job_profiles WHERE id = $1', [profiles[0]]), 1);

  // B elimina SU cuenta con su contraseña: el perfil de A sigue intacto.
  const rb = await auth.deleteAccount(userB, { password: 'clave-segura-b', confirmation: 'ELIMINAR' });
  assert.equal(rb.removed.profiles, 1);
  assert.equal(await count('SELECT count(*)::int n FROM job_profiles WHERE id = $1', [profiles[0]]), 1);
  assert.equal(await count('SELECT count(*)::int n FROM job_profiles WHERE id = $1', [profiles[1]]), 0);
  assert.equal(await auth.userFromToken(b.session.token), null);

  // A elimina su cuenta: perfil, competencias, evaluaciones, sesiones y cuenta desaparecen.
  const ra = await auth.deleteAccount(userA, { password: 'clave-segura-a', confirmation: 'ELIMINAR' });
  assert.deepEqual(ra, { deleted: true, removed: { profiles: 1, competencies: 1, evidence: 0, assessments: 1 } });
  for (const [sql, p] of [
    ['SELECT count(*)::int n FROM job_profiles WHERE id = $1', [profiles[0]]],
    ['SELECT count(*)::int n FROM profile_competencies WHERE profile_id = $1', [profiles[0]]],
    ['SELECT count(*)::int n FROM competency_assessments WHERE profile_id = $1', [profiles[0]]],
    ['SELECT count(*)::int n FROM user_accounts WHERE email = $1', [emails[0]]],
    ['SELECT count(*)::int n FROM account_sessions WHERE user_id = $1', [userA.id]],
  ]) assert.equal(await count(sql, p), 0, sql);
  assert.equal(await auth.userFromToken(a.session.token), null);
  // El perfil sin dueño no se ve afectado.
  assert.equal(await count('SELECT count(*)::int n FROM job_profiles WHERE id = $1', [profiles[2]]), 1);
});
