// Coherencia del conjunto HISTÓRICO de evaluación de la siguiente acción (QVAC Decisions,
// retirado; ver docs/interview-actions-evaluacion.md) y de su puntuación. Sin modelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allowedOptions, OPTION_IDS } from '../eval/interview-actions/actions.js';
import { looksLikeEpisode } from '../server/interview/state.js';
import { CASES } from '../eval/interview-actions/dataset.js';
import { actionOk, scoreTurn } from '../eval/interview-actions/score.js';

test('33 casos en las categorías pedidas, con opciones válidas y ids únicos', () => {
  assert.equal(CASES.length, 33);
  const by = Object.groupBy(CASES, (c) => c.categoria);
  assert.deepEqual(Object.keys(by), ['vaga', 'concreta', 'resultado', 'aclaracion', 'fuera_de_tema', 'contradiccion']);
  for (const c of CASES) for (const id of c.ok) assert.ok(OPTION_IDS.includes(id), `${c.id}: ${id}`);
  assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length);
});

test('las opciones aceptables siempre están entre las que permiten las reglas', () => {
  for (const c of CASES) {
    const answers = [...(c.prev || []).map((p) => p[1]), c.respuesta];
    const dialog = answers.map((a) => ({ role: 'user', content: a }));
    const state = { dialog, preguntas: [{ texto: c.pregunta, area: 'hoy', accion: 'preguntar' }], areas: { antes: 'pendiente', hoy: 'parcial', cambios: 'pendiente', despues: 'pendiente' } };
    const { allowed } = allowedOptions(state, c.respuesta);
    assert.ok(c.ok.some((id) => allowed.includes(id)), c.id);
  }
});

test('las vagas no relatan un hecho puntual; las de resultado sí', () => {
  for (const c of CASES.filter((x) => x.categoria === 'vaga')) assert.ok(!looksLikeEpisode(c.respuesta), c.id);
  for (const c of CASES.filter((x) => x.categoria === 'resultado')) assert.ok(looksLikeEpisode(c.respuesta), c.id);
});

test('puntuación: acción equivalente, foco de la pregunta y cierre', () => {
  const caso = { ok: ['preguntar_resultado'], foco: 'resultado' };
  assert.deepEqual(scoreTurn(caso, { accion: 'profundizar', texto: '¿Cómo terminó eso?' }), { acceptable: true, pertinent: true });
  assert.deepEqual(scoreTurn(caso, { accion: 'profundizar', texto: '¿Por qué te lo pidieron?' }), { acceptable: true, pertinent: false });
  assert.deepEqual(scoreTurn(caso, { accion: 'pedir_ejemplo', texto: '¿Cómo terminó?' }), { acceptable: false, pertinent: false });
  assert.equal(scoreTurn(caso, { accion: 'cerrar', texto: '', close: true }).acceptable, false);
  assert.ok(actionOk('retomar', ['explorar_otra_experiencia']), 'preguntar y retomar son equivalentes');
  assert.ok(!actionOk('profundizar', ['aclarar']));
});
