// Cuentas: contraseñas, cookies de sesión y reglas de las rutas (sin base de datos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CookieResponse, createApp } from '../server/app.js';
import { hashPassword, SESSION_COOKIE, verifyPassword } from '../server/auth/service.js';

const llm = { describe: () => ({ status: 'ready' }) };
const alice = { id: 'a1', email: 'ana@example.test', password_hash: 'x', created_at: new Date('2026-10-01') };

/** Servicio de cuentas simulado: registra cada llamada para comprobar qué usuario se usó. */
function fakeAuth({ deleteFails = false } = {}) {
  const sessions = { 'token-de-ana-con-longitud-suficiente': alice, 'token-de-beto-con-longitud-suficiente': { ...alice, id: 'b2', email: 'beto@example.test' } };
  const calls = [];
  return {
    calls,
    userFromToken: async (t) => sessions[t] || null,
    describe: async (u) => ({ email: u.email, createdAt: u.created_at.toISOString(), profileIds: [] }),
    register: async (body) => ({ user: { email: body.email }, session: { token: 'nuevo-token-de-sesion-largo', expires: new Date(Date.now() + 1e9) } }),
    login: async () => { throw Object.assign(new Error('Correo o contraseña incorrectos.'), { status: 401, code: 'invalid_credentials' }); },
    logout: async (t) => calls.push(['logout', t]),
    deleteAccount: async (user, body) => {
      calls.push(['delete', user.id, body]);
      if (deleteFails) throw new Error('conexión perdida');
      return { deleted: true, removed: { profiles: 1 } };
    },
  };
}

test('las contraseñas se guardan con scrypt y sal; se verifican sin revelar el texto', async () => {
  const a = await hashPassword('clave-segura-1');
  const b = await hashPassword('clave-segura-1');
  assert.match(a, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(a, b);
  assert.ok(!a.includes('clave-segura-1'));
  assert.equal(await verifyPassword('clave-segura-1', a), true);
  assert.equal(await verifyPassword('otra-clave', a), false);
  assert.equal(await verifyPassword('clave-segura-1', 'texto-plano'), false);
});

test('crear cuenta deja una cookie de sesión HttpOnly; cerrar sesión la borra', async () => {
  const auth = fakeAuth();
  const handle = createApp({ llm, auth });
  const r = await handle('POST', '/auth/register', { email: 'ana@example.test', password: 'clave-segura-1' });
  assert.ok(r instanceof CookieResponse);
  assert.match(r.cookies[0], new RegExp(`^${SESSION_COOKIE}=nuevo-token-de-sesion-largo; Path=/; HttpOnly; SameSite=Lax; Expires=`));
  assert.ok(!JSON.stringify(r.body).includes('nuevo-token'));
  const out = await handle('POST', '/auth/logout', null, undefined, { cookies: { [SESSION_COOKIE]: 'token-de-ana-con-longitud-suficiente' } });
  assert.match(out.cookies[0], /Max-Age=0/);
  assert.deepEqual(auth.calls[0], ['logout', 'token-de-ana-con-longitud-suficiente']);
  const secure = await createApp({ llm, auth, secureCookies: true })('POST', '/auth/register', { email: 'x@example.test', password: 'clave-segura-1' });
  assert.match(secure.cookies[0], /; Secure$/);
});

test('GET /auth/me solo devuelve la cuenta con una sesión válida', async () => {
  const handle = createApp({ llm, auth: fakeAuth() });
  assert.deepEqual(await handle('GET', '/auth/me'), { user: null });
  assert.deepEqual(await handle('GET', '/auth/me', null, undefined, { cookies: { [SESSION_COOKIE]: 'inventado-pero-largo-de-verdad' } }), { user: null });
  const me = await handle('GET', '/auth/me', null, undefined, { cookies: { [SESSION_COOKIE]: 'token-de-ana-con-longitud-suficiente' } });
  assert.equal(me.user.email, 'ana@example.test');
});

test('eliminar cuenta exige sesión y siempre usa la cuenta de la sesión, no un id del cuerpo', async () => {
  const auth = fakeAuth();
  const handle = createApp({ llm, auth });
  await assert.rejects(handle('DELETE', '/account', { password: 'x', confirmation: 'ELIMINAR', userId: 'a1' }), (e) => e.status === 401);
  assert.equal(auth.calls.length, 0);
  const r = await handle('DELETE', '/account', { password: 'x', confirmation: 'ELIMINAR', userId: 'a1' }, undefined, { cookies: { [SESSION_COOKIE]: 'token-de-beto-con-longitud-suficiente' } });
  assert.equal(auth.calls[0][1], 'b2');
  assert.equal(r.body.deleted, true);
  assert.match(r.cookies[0], /Max-Age=0/);
});

test('si la eliminación falla, el error es real, no se borra la cookie y no se confirma nada', async () => {
  const handle = createApp({ llm, auth: fakeAuth({ deleteFails: true }) });
  await assert.rejects(
    handle('DELETE', '/account', { password: 'x', confirmation: 'ELIMINAR' }, undefined, { cookies: { [SESSION_COOKIE]: 'token-de-ana-con-longitud-suficiente' } }),
    (e) => e.status === 503 && /No se borró ningún dato/.test(e.message),
  );
  await assert.rejects(handle('POST', '/auth/login', { email: 'ana@example.test', password: 'mal' }), (e) => e.status === 401 && e.extra.code === 'invalid_credentials');
});

test('sin base de datos las cuentas responden 503, no un éxito', async () => {
  const handle = createApp({ llm });
  await assert.rejects(handle('POST', '/auth/register', { email: 'a@b.pe', password: '12345678' }), (e) => e.status === 503);
  await assert.rejects(handle('DELETE', '/account', {}), (e) => e.status === 503);
});

test('interfaz: botones junto a «Preguntas frecuentes» y «Eliminar cuenta» solo en Mi cuenta con sesión', () => {
  const shell = readFileSync(new URL('../src/components/layout/AppShell.jsx', import.meta.url), 'utf8');
  const nav = shell.indexOf('className="topbar-nav"');
  const auth = shell.indexOf('<AccountLinks variant="bar" />');
  const demo = shell.indexOf('topbar-demo"');
  assert.ok(nav > 0 && auth > nav && auth < demo, 'los botones van inmediatamente después de la navegación (Inicio, Preguntas frecuentes)');
  assert.match(shell, /to="\/iniciar-sesion"[\s\S]*Iniciar sesión[\s\S]*to="\/crear-cuenta"[\s\S]*Crear cuenta/);
  assert.match(shell, /<AccountLinks variant="sheet" \/>/);
  assert.ok(!shell.includes('Eliminar cuenta'));
  const account = readFileSync(new URL('../src/pages/AccountPage.jsx', import.meta.url), 'utf8');
  assert.ok(account.indexOf('if (!user)') < account.indexOf('Eliminar cuenta'));
  assert.match(account, /if \(!r\?\.deleted\) throw/);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const path of ['iniciar-sesion', 'crear-cuenta', 'cuenta']) assert.ok(app.includes(`path="${path}"`));
});
