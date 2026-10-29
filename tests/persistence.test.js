// La API y PostgreSQL, con una base SIMULADA (no necesita PostgreSQL).
// Comprueba que la conversación no escribe en la base y que /health
// informa el estado real de la conexión. La prueba con PostgreSQL real
// está en tests/db.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../server/app.js';
import { BASICS, notes, ques, scriptedLlm } from './helpers/conversation.js';

/** Base simulada que registra cada consulta. */
function fakeDb({ fail = false } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (fail) throw new Error('conexión rechazada');
      return { rows: [] };
    },
  };
}

const OPEN = ques('¿Cómo aprendiste lo que haces hoy?', { area: 'antes' });

test('la conversación con QVAC no escribe transcripciones en la base de datos', async () => {
  const db = fakeDb();
  const app = createApp({ llm: scriptedLlm([OPEN, notes(), ques('¿Cómo repones los anaqueles?')]), db });
  let r = await app('POST', '/diagnosis/start', null);
  for (const input of BASICS) r = await app('POST', `/diagnosis/${r.session.id}/answer`, { input });
  r = await app('POST', `/diagnosis/${r.session.id}/answer`, { input: { text: 'Repongo anaqueles.' } });
  assert.equal(r.session.stage, 'entrevista');
  assert.equal(r.messages.at(-1).text, '¿Cómo repones los anaqueles?');
  assert.equal(r.persistence, undefined);
  assert.deepEqual(db.queries, [], 'el chat no consulta la base');
});

test('/health informa el estado real de PostgreSQL', async () => {
  const llm = scriptedLlm([]);
  assert.equal((await createApp({ llm, db: fakeDb() })('GET', '/health', null)).db.status, 'ready');
  assert.equal((await createApp({ llm, db: fakeDb({ fail: true }) })('GET', '/health', null)).db.status, 'error');
  assert.equal((await createApp({ llm })('GET', '/health', null)).db.status, 'disabled');
});

test('si PostgreSQL no responde, el chat sigue funcionando', async () => {
  const app = createApp({ llm: scriptedLlm([]), db: fakeDb({ fail: true }) });
  let r = await app('POST', '/diagnosis/start', null);
  r = await app('POST', `/diagnosis/${r.session.id}/answer`, { input: BASICS[0] });
  assert.equal(r.session.stage, 'nombre');
});

test('ya no existe el endpoint de mensajes guardados', async () => {
  const app = createApp({ llm: scriptedLlm([]), db: fakeDb() });
  const r = await app('POST', '/diagnosis/start', null);
  await assert.rejects(app('GET', `/diagnosis/${r.session.id}/messages`, null), (e) => e.status === 404);
});
