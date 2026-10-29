// Pruebas del motor de demostración (Node test runner: `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractCompetencies, detectOccupations, mentionsOutOfScope } from '../src/services/engine/extractor.js';
import { evaluateEvidence } from '../src/services/engine/evidence.js';
import { advance, startSession, describeStage } from '../src/services/engine/diagnosisFlow.js';
import { compareAll } from '../src/services/engine/matcher.js';
import { buildRoute } from '../src/services/engine/routeBuilder.js';
import { buildDemoCase } from '../src/services/kallpaService.js';
import { OCCUPATION_IDS, OCCUPATIONS } from '../src/data/occupations.js';
import { COMPETENCIES } from '../src/data/competencies.js';

const ids = (text) => extractCompetencies(text).map((c) => c.id).sort();

test('el alcance es exactamente cinco ocupaciones', () => {
  assert.deepEqual(OCCUPATION_IDS, ['limpieza', 'administrativo', 'reponedor', 'vendedor', 'cajero']);
});

test('los datos de referencia son consistentes', () => {
  for (const o of Object.values(OCCUPATIONS)) {
    for (const r of o.requires) assert.ok(COMPETENCIES[r.id], `${o.id} requiere ${r.id} inexistente`);
  }
  for (const c of Object.values(COMPETENCIES)) {
    for (const b of c.bases) assert.ok(COMPETENCIES[b.id], `${c.id} tiene base ${b.id} inexistente`);
    assert.ok(c.learn.length >= 2, `${c.id} necesita actividades`);
  }
});

test('nombrar la ocupación NO genera competencias', () => {
  assert.deepEqual(ids('Trabajé como vendedora y también como cajera.'), []);
});

test('detecta competencias de cada ocupación', () => {
  assert.ok(ids('Cada semana reviso qué insumos faltan y aviso a la supervisora').includes('control_suministros'));
  assert.ok(ids('Archivo los documentos y registro datos en Excel').includes('org_documentos'));
  assert.ok(ids('Archivo los documentos y registro datos en Excel').includes('herramientas_digitales'));
  assert.ok(ids('Repongo los productos en los anaqueles y hago el conteo de stock').includes('reposicion'));
  assert.ok(ids('Repongo los productos en los anaqueles y hago el conteo de stock').includes('control_existencias'));
  assert.ok(ids('Atiendo a los clientes y les recomiendo productos para cerrar la venta').includes('ventas'));
  assert.ok(ids('Cobro en efectivo, doy el vuelto y acepto Yape').includes('calculo_vuelto'));
  assert.ok(ids('Cobro en efectivo, doy el vuelto y acepto Yape').includes('medios_pago'));
  assert.ok(ids('Al final del turno hago el cuadre de caja').includes('registro_transacciones'));
});

test('"productos de limpieza" no se confunde con organización de productos', () => {
  const found = ids('Acomodo los productos de limpieza en el carrito');
  assert.ok(found.includes('uso_productos'));
  assert.ok(!found.includes('org_productos'));
});

test('detecta ocupaciones y temas fuera de alcance', () => {
  assert.deepEqual(detectOccupations('trabajé en una bodega y en caja'), ['vendedor', 'cajero']);
  assert.equal(mentionsOutOfScope('trabajé en construcción'), true);
});

test('evaluación de evidencia', () => {
  assert.equal(evaluateEvidence('Sí lo hago').level, 'insuficiente');
  assert.equal(evaluateEvidence('Sí, organizo los materiales del área').level, 'parcial');
  assert.equal(evaluateEvidence('Cada lunes reviso el depósito y anoto lo que falta en un cuaderno.').level, 'fuerte');
});

test('flujo completo de diagnóstico', () => {
  let s = startSession();
  const send = (input) => (s = advance(s, input).session);
  send({ choices: ['empezar'] });
  send({ text: 'Pedro' });
  assert.equal(s.profile.alias, 'Pedro');
  send({ choices: ['cajero'] });
  send({ choices: ['informal'] });
  send({ choices: ['1a3'] });
  send({ text: 'Cobro a los clientes, doy el vuelto y al cerrar hago el cuadre de caja.' });
  send({ text: 'POS y Yape' });
  assert.equal(s.profile.competencies.medios_pago.status, 'por_validar');
  send({ text: 'Era responsable del dinero de la caja.' });
  send({ text: 'Una vez la caja no cuadraba y revisé los tickets uno por uno hasta encontrar el error.' });
  assert.equal(s.stage, 'evidencia');
  while (s.stage === 'evidencia') {
    send({ text: 'Cada noche cuento el efectivo dos veces y comparo con el reporte del sistema antes de entregar.' });
  }
  assert.equal(s.stage, 'fin');
  assert.ok(Object.values(s.profile.competencies).some((c) => c.status === 'evidencia'));
  assert.equal(describeStage(s).input, 'none');
});

test('caso de demostración: María', () => {
  const demo = buildDemoCase();
  const p = demo.profile;
  assert.equal(p.alias, 'María');
  assert.deepEqual(p.experience.occupations, ['limpieza']);
  assert.ok(p.competencies.control_suministros);
  assert.equal(p.competencies.control_suministros.status, 'evidencia');
  const cmp = compareAll(p);
  assert.equal(cmp.length, 5);
  const repo = cmp.find((c) => c.occupationId === 'reponedor');
  assert.ok(repo.transferable.some((t) => t.id === 'control_existencias'));
  const route = buildRoute(p, 'reponedor');
  assert.ok(route.stages.find((st) => st.id === 'desarrolla').items.length > 0);
  // Imprime un resumen útil al ejecutar las pruebas
  console.log('María →', Object.values(p.competencies).map((c) => `${c.id}:${c.status}`).join(', '));
  console.log('Cercanía →', cmp.map((c) => `${c.occupationId}:${c.closeness}(${c.matches.length}/${c.transferable.length}/${c.gaps.length})`).join(' '));
});

test('un ejemplo que habla de otra competencia no la respalda', async () => {
  const { addExample, addMention, createEmptyProfile } = await import('../src/services/engine/profile.js');
  let p = createEmptyProfile();
  p = addMention(p, 'atencion_cliente', 'Atiendo clientes', 'tareas').profile;
  const r = addExample(p, 'atencion_cliente', 'Cada noche cuento el efectivo dos veces y lo comparo con el reporte.');
  assert.equal(r.level, 'parcial');
  assert.equal(r.mismatch, 'manejo_dinero');
  assert.equal(r.profile.competencies.atencion_cliente.status, 'declarada');
});

test('puestos recomendados: catálogo consistente y seis sugerencias para María', async () => {
  const { JOBS } = await import('../src/data/jobs.js');
  const { recommendJobs } = await import('../src/services/engine/jobMatcher.js');
  for (const j of JOBS) {
    for (const r of j.requires) assert.ok(COMPETENCIES[r.id], `${j.id} requiere ${r.id} inexistente`);
    assert.ok(j.search, `${j.id} sin término de búsqueda`);
  }
  const recs = recommendJobs(buildDemoCase().profile, 6);
  assert.equal(recs.length, 6);
  for (const r of recs) {
    assert.ok(r.matches.length > 0, `${r.jobId} sin coincidencias`);
    assert.match(r.url, /^https:\/\/(www\.)?empleosperu\.gob\.pe/);
  }
  assert.deepEqual([...recs].sort((a, b) => b.ratio - a.ratio), recs);
  console.log('María →', recs.map((r) => `${r.name} (${Math.round(r.ratio * 100)}%)`).join(', '));
});

test('ruta hacia un puesto recomendado (fuera de las cinco ocupaciones)', async () => {
  const { getTarget } = await import('../src/services/engine/targets.js');
  const p = buildDemoCase().profile;
  const r = buildRoute(p, 'aux_almacen');
  assert.equal(r.target.kind, 'job');
  assert.equal(r.target.name, 'Auxiliar de almacén');
  assert.equal(r.stages.length, 4);
  const buscar = r.stages.at(-1).items.find((i) => i.id === 'postula-buscar');
  assert.match(buscar.resource.url, /empleosperu\.gob\.pe/);
  assert.ok(r.stages.find((s) => s.id === 'prepara').items.every((i) => !('list' in i) || i.list.length));
  assert.equal(getTarget('reponedor').kind, 'occupation');
  assert.equal(getTarget('no-existe'), null);
});

test('al terminar sin competencias reconocidas se ofrece empezar de nuevo, no ver el perfil', async () => {
  const { describeStage, startSession } = await import('../src/services/engine/diagnosisFlow.js');
  const empty = { ...startSession(), stage: 'fin', done: true };
  assert.deepEqual(describeStage(empty).actions.map((a) => a.id), ['reiniciar']);
  assert.equal(describeStage(empty).actions[0].restart, true);
  const withComp = { ...empty, profile: { ...empty.profile, competencies: { ventas: { id: 'ventas', status: 'declarada', mentions: [], examples: [] } } } };
  assert.deepEqual(describeStage(withComp).actions.map((a) => a.id), ['perfil', 'ocupaciones']);
});
