import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createApp } from '../server/app.js';
import { bankQuestionsFor, loadBank } from '../server/assessment/bank.js';
import { checkGeneratedQuestion, copiesReference } from '../server/assessment/generate.js';
import { buildBank, parseSource, SOURCE_FILE } from '../server/assessment/import.js';
import { createAssessmentService } from '../server/assessment/service.js';
import { createAssessmentMemoryStore } from '../server/assessment/store.js';
import { LEGEND } from '../server/assessment/certificate.js';
import { summarizeAssessment } from '../src/services/engine/assessment.js';

const bank = loadBank();
const FONTS = `${fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replace(/\\/g, '/')}`;
const evidence = (id, text) => ({ id, status: 'evidencia', examples: [{ text, level: 'fuerte' }], mentions: [] });
const profile = {
  alias: 'Rosa', target: 'limpieza', experience: { occupations: ['limpieza'] }, dismissed: ['comunicacion'],
  competencies: {
    protocolos: evidence('protocolos', 'Siempre ponía el letrero de piso mojado y usaba guantes al limpiar los baños del colegio.'),
    control_suministros: evidence('control_suministros', 'Cada viernes revisaba el papel y el jabón y avisaba a la encargada lo que faltaba.'),
    uso_productos: { id: 'uso_productos', status: 'declarada', examples: [], mentions: [] },
    comunicacion: evidence('comunicacion', 'Explicaba a los alumnos dónde botar la basura.'),
  },
};

const SCENES = [
  'Llegas temprano y encuentras la puerta del depósito abierta y cajas mojadas en el suelo',
  'Un cliente mayor te pide ayuda mientras tu supervisora te llama desde otra área',
  'A mitad del turno notas que la lista de tareas del día tiene un error en las horas',
  'Un compañero nuevo usa un equipo sin protección y te pregunta si lo está haciendo bien',
];

/** QVAC simulado: genera dos preguntas por competencia y verifica conociendo su propia clave. */
function fakeLlm({ verifierAgrees = () => true, status = 'ready' } = {}) {
  const keys = new Map();
  let n = 0;
  return {
    calls: [],
    describe: () => ({ status }),
    async generate({ history, responseFormat }) {
      this.calls.push(responseFormat.json_schema.name);
      const input = JSON.parse(history[1].content);
      if (responseFormat.json_schema.name === 'kallpa_preguntas') {
        const questions = [0, 1].map(() => {
          n++;
          const situation = `${SCENES[(n - 1) % SCENES.length]} (${input.competencia.nombre}, caso ${n}). ¿Qué haces?`;
          keys.set(situation, `Acción correcta ${n}: sigues el procedimiento y avisas a tu responsable.`);
          return { situation, options: [`Ignoras lo ocurrido ${n}.`, keys.get(situation), `Lo resuelves sin avisar ${n}.`, `Culpas a un compañero ${n}.`, `Te vas sin terminar ${n}.`], correctIndex: 1, explanation: 'Seguir el procedimiento y avisar protege a todos y evita errores.' };
        });
        return { text: JSON.stringify({ questions }) };
      }
      return { text: JSON.stringify({ answers: input.preguntas.map((p, i) => {
        const correct = p.alternativas.findIndex((a) => a.slice(3) === keys.get(p.situacion));
        return { id: p.id, best: verifierAgrees(p.situacion, i) ? correct + 1 : ((correct + 1) % 5) + 1, otherAcceptable: false, unambiguous: true, measuresCompetency: true };
      }) }) };
    },
  };
}

let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const service = (llm = fakeLlm(), store = createAssessmentMemoryStore()) => createAssessmentService({ llm, store, random });

async function ready(svc, args) {
  const started = await svc.start(args);
  await svc.idle(started.id);
  return svc.get(started.id);
}

/** Respuestas correctas según el backend (solo para pruebas: la interfaz nunca las recibe antes). */
async function keyOf(store, id) {
  const attempt = await store.get(id);
  return Object.fromEntries(attempt.items.map((i) => [i.id, i.correctToken]));
}

async function pdfText(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer), standardFontDataUrl: FONTS }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) text += (await (await doc.getPage(p)).getTextContent()).items.map((i) => i.str).join(' ');
  return text.replace(/\s+/g, ' ');
}

test('el banco estructurado coincide exactamente con el material original y sus [CORRECTA]', () => {
  const source = readFileSync(SOURCE_FILE, 'utf8');
  assert.deepEqual(buildBank(parseSource(source)), bank);
  assert.equal(bank.length, 20);
  for (const q of bank) {
    const block = source.slice(source.indexOf(q.situation));
    const marked = block.match(/^([A-E])\) \[CORRECTA\]/m)[1];
    assert.equal(q.correctOptionId, marked, q.id);
    assert.equal(q.options.length, 5);
    assert.equal(q.validation.status, 'validada');
  }
});

test('solo se evalúan las competencias con evidencia (no declaradas ni descartadas), dos preguntas cada una', async () => {
  const attempt = await ready(service(), { profile });
  assert.equal(attempt.status, 'lista');
  assert.deepEqual(attempt.competencies.map((c) => c.id).sort(), ['control_suministros', 'protocolos']);
  for (const c of attempt.competencies) assert.equal(attempt.items.filter((i) => i.competencyId === c.id).length, 2);
  assert.ok(attempt.items.every((i) => i.source === 'qvac' && i.options.length === 5));
});

test('la interfaz no recibe la clave ni la explicación antes de responder', async () => {
  const store = createAssessmentMemoryStore();
  const attempt = await ready(service(fakeLlm(), store), { profile });
  const json = JSON.stringify(attempt);
  assert.ok(!/"correct|"explanation|correctToken/.test(json));
  assert.ok(!json.includes('Seguir el procedimiento y avisar'));
  assert.equal(attempt.results, null);
  // Identificadores opacos: no son letras A–E ni índices.
  assert.ok(attempt.items.every((i) => i.options.every((o) => /^[0-9a-f]{10}$/.test(o.id))));
});

test('la pregunta que QVAC no puede verificar se descarta y se completa con el banco validado', async () => {
  // Solo la primera situación generada pasa la verificación; las demás (incluida la segunda ronda) no.
  const llm = fakeLlm({ verifierAgrees: (situation) => situation.includes('caso 1)') });
  const attempt = await ready(service(llm), { profile, competencyIds: ['protocolos'] });
  const sources = attempt.items.map((i) => i.source).sort();
  assert.deepEqual(sources, ['banco', 'qvac']);
  const bankItem = attempt.items.find((i) => i.source === 'banco');
  assert.ok(bankQuestionsFor(bank, 'protocolos', 'limpieza').some((q) => q.situation === bankItem.situation));
});

test('sin QVAC se usa el banco; la competencia sin dos preguntas validadas queda como carencia y no se inventa', async () => {
  const p = { ...profile, competencies: { ...profile.competencies, org_materiales: evidence('org_materiales', 'Ordenaba el carrito de limpieza por tipo de producto.') } };
  const llm = fakeLlm({ status: 'loading' });
  const attempt = await ready(service(llm), { profile: p });
  assert.equal(llm.calls.length, 0);
  assert.equal(attempt.qvac.used, false);
  assert.ok(attempt.items.every((i) => i.source === 'banco'));
  // Control de suministros y Organización de materiales tienen una sola pregunta validada en el banco.
  assert.deepEqual(attempt.gaps.map((g) => g.competencyId).sort(), ['control_suministros', 'org_materiales']);
  assert.equal(attempt.items.filter((i) => i.competencyId === 'protocolos').length, 2);
  assert.equal(attempt.items.filter((i) => i.competencyId === 'org_materiales').length, 0);
});

test('preguntas generadas con estructura inválida se rechazan', () => {
  const good = { situation: 'Una situación suficientemente larga para evaluar la competencia en el trabajo.', options: ['a1a', 'b2b', 'c3c', 'd4d', 'e5e'], correctIndex: 2, explanation: 'Explicación suficiente de la respuesta.' };
  assert.deepEqual(checkGeneratedQuestion(good), []);
  assert.ok(checkGeneratedQuestion({ ...good, options: good.options.slice(0, 4) }).length);
  assert.ok(checkGeneratedQuestion({ ...good, options: ['a1a', 'a1a', 'c3c', 'd4d', 'e5e'] }).length);
  assert.ok(checkGeneratedQuestion({ ...good, correctIndex: 5 }).length);
  assert.ok(checkGeneratedQuestion({ ...good, options: ['a1a', 'b2b', 'c3c', 'd4d', 'Todas las anteriores'] }).length);
  // La explicación no puede citar posiciones: las alternativas se barajan.
  assert.ok(checkGeneratedQuestion({ ...good, explanation: 'La opción 1 es la más adecuada porque explica el problema.' }).length);
  // Caso real de QVAC: las cinco alternativas repiten el mismo comienzo.
  const start = 'Revisas el depósito, cuentas los rollos de papel y anotas lo que falta';
  assert.ok(checkGeneratedQuestion({ ...good, options: [`${start}, luego avisas a la supervisora.`, `${start}, pero te quedas en la duda.`, `${start}, pero te olvidas de avisar.`, `${start}, pero improvisas una solución.`, `${start}, pero no avisas a nadie.`] }).includes('alternativas casi iguales'));
});

test('se rechaza la pregunta que copia la situación o las alternativas del banco de referencia', () => {
  const ref = bank.find((q) => q.id === 'limpieza-04');
  const copied = { situation: 'Un compañero te pide limpiar una mancha de café en una mesa de madera y solo tienes lejía y limpiavidrios.', options: ref.options.map((o) => o.text.replace('alfombras', 'mesas de madera')), correctIndex: 1, explanation: 'Explicación suficiente de la respuesta.' };
  assert.equal(copiesReference(copied, [ref]), true);
  const fresh = { situation: 'Al preparar el balde notas que el desinfectante no tiene etiqueta y huele distinto al de siempre.', options: ['Lo usas igual porque tiene el mismo color.', 'Lo mezclas con lejía para reforzarlo.', 'No lo usas, lo separas y preguntas a tu supervisora qué producto es.', 'Lo botas por el desagüe sin avisar.', 'Lo pasas a otra botella sin rotular.'], correctIndex: 2, explanation: 'Un producto sin identificar no se usa: se separa y se consulta.' };
  assert.equal(copiesReference(fresh, [ref]), false);
});

test('aprobación por competencia: dos correctas aprueban; una sola no; las alternativas barajadas no alteran la corrección', async () => {
  const store = createAssessmentMemoryStore();
  const svc = service(fakeLlm(), store);
  const attempt = await ready(svc, { profile });
  const key = await keyOf(store, attempt.id);
  const answers = { ...key };
  const wrong = attempt.items.find((i) => i.competencyId === 'control_suministros');
  answers[wrong.id] = wrong.options.find((o) => o.id !== key[wrong.id]).id;
  const done = await svc.submit(attempt.id, answers);
  const byId = Object.fromEntries(done.results.competencies.map((c) => [c.competencyId, c]));
  assert.equal(byId.protocolos.approved, true);
  assert.equal(byId.protocolos.correct, 2);
  assert.equal(byId.control_suministros.approved, false);
  assert.equal(byId.control_suministros.correct, 1);
  // La interfaz recalcula con la misma regla y obtiene lo mismo que el backend.
  const front = summarizeAssessment(done.results.items);
  assert.equal(front.approvedCount, done.results.approvedCount);
  assert.deepEqual(front.competencies.map((c) => c.approved), done.results.competencies.map((c) => c.approved));
  // El orden de las alternativas cambia entre intentos, pero la clave sigue la alternativa correcta.
  const other = await ready(svc, { profile });
  const otherKey = await keyOf(store, other.id);
  const correctText = (a, k) => a.items.map((i) => i.options.find((o) => o.id === k[i.id]).text);
  assert.ok(correctText(other, otherKey).every((t) => t.startsWith('Acción correcta')));
  assert.ok(correctText(attempt, key).every((t) => t.startsWith('Acción correcta')));
});

test('constancia: no hay antes de terminar ni para competencias no aprobadas; sí por competencia y consolidada', async () => {
  const store = createAssessmentMemoryStore();
  const svc = service(fakeLlm(), store);
  const attempt = await ready(svc, { profile, profileId: null });
  await assert.rejects(svc.certificate(attempt.id, { competencyId: 'protocolos' }), (e) => e.status === 409);
  await assert.rejects(svc.submit(attempt.id, {}), (e) => e.status === 400 && /Responde todas/.test(e.message));
  const key = await keyOf(store, attempt.id);
  const answers = { ...key };
  for (const i of attempt.items.filter((x) => x.competencyId === 'control_suministros')) answers[i.id] = i.options.find((o) => o.id !== key[i.id]).id;
  const done = await svc.submit(attempt.id, answers);
  assert.equal(done.results.approvedCount, 1);
  await assert.rejects(svc.certificate(attempt.id, { competencyId: 'control_suministros' }), (e) => e.status === 403);
  await assert.rejects(svc.certificate(attempt.id, { competencyId: 'protocolos', participantName: 'Rosa Quispe' }), (e) => e.status === 400 && e.code === 'name_not_confirmed');

  const file = await svc.certificate(attempt.id, { competencyId: 'protocolos', participantName: 'Rosa Quispe', participantNameConfirmed: true });
  assert.equal(file.contentType, 'application/pdf');
  assert.match(file.filename, /^Constancia_KALLPA_protocolos_[0-9a-f]{8}\.pdf$/);
  const text = await pdfText(file.buffer);
  for (const expected of ['Constancia de Evaluación de Competencias', 'Rosa Quispe', 'Cumplimiento de protocolos', 'Personal de limpieza', `KALLPA-EV-${attempt.id.slice(0, 8).toUpperCase()}-PROTOCOLOS`, 'Respondió correctamente 2 de 2']) assert.ok(text.includes(expected), expected);
  assert.ok(text.includes(LEGEND.slice(0, 60)));
  assert.ok(!text.includes('Control de suministros'));
  // La constancia consolidada solo lista las aprobadas.
  const all = await pdfText((await svc.certificate(attempt.id, {})).buffer);
  assert.ok(all.includes('Cumplimiento de protocolos') && !all.includes('Control de suministros') && all.includes('No indicado'));
});

test('varias competencias aprobadas: una constancia por cada una', async () => {
  const store = createAssessmentMemoryStore();
  const svc = service(fakeLlm(), store);
  const attempt = await ready(svc, { profile });
  const done = await svc.submit(attempt.id, await keyOf(store, attempt.id));
  assert.equal(done.results.approvedCount, 2);
  for (const c of done.results.competencies) {
    const file = await svc.certificate(attempt.id, { competencyId: c.competencyId });
    assert.ok((await pdfText(file.buffer)).includes(c.name));
  }
});

test('HTTP: inicio, consulta, corrección y descarga; errores reales sin constancias ficticias', async () => {
  const store = createAssessmentMemoryStore();
  const assessments = service(fakeLlm(), store);
  const handle = createApp({ llm: fakeLlm(), assessments });
  const started = await handle('POST', '/assessments', { profile });
  assert.equal(started.status, 'preparando');
  assert.equal(started.simulation, true);
  await assessments.idle(started.id);
  const attempt = await handle('GET', `/assessments/${started.id}`);
  assert.equal(attempt.status, 'lista');
  await assert.rejects(handle('POST', `/assessments/${started.id}/certificate`, {}), (e) => e.status === 409);
  const done = await handle('POST', `/assessments/${started.id}/submit`, { answers: await keyOf(store, started.id) });
  assert.equal(done.status, 'completada');
  const file = await handle('POST', `/assessments/${started.id}/certificate`, { competencyId: 'protocolos' });
  assert.equal(file.buffer.subarray(0, 5).toString(), '%PDF-');
  await assert.rejects(handle('GET', '/assessments/00000000-0000-4000-8000-000000000000'), (e) => e.status === 404);
  await assert.rejects(handle('POST', '/assessments', { profile: { competencies: {} } }), (e) => e.status === 422);

  const broken = createApp({ llm: fakeLlm(), assessments: { certificate: async () => { throw new Error('pdfkit falló'); } } });
  await assert.rejects(broken('POST', `/assessments/${started.id}/certificate`, {}), (e) => e.status === 503 && /No se pudo generar la constancia/.test(e.message) && e.extra.retryable);
});

test('interfaz: «Validar competencias» al final de las tarjetas con evidencia y «Obtener constancia» solo si se aprobó', () => {
  const profilePage = readFileSync(new URL('../src/pages/ProfilePage.jsx', import.meta.url), 'utf8');
  const grid = profilePage.indexOf('className="skill-grid"');
  const cta = profilePage.indexOf('Validar competencias');
  assert.ok(grid > 0 && cta > grid);
  assert.match(profilePage, /active === 'evidencia' && visible\.length > 0 && \(\s*<div className="card assess-cta">/);
  const page = readFileSync(new URL('../src/pages/AssessmentPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /\{c\.approved && <CertificateButton label="Obtener constancia"/);
  assert.match(page, /results\.approvedCount > 1 && <CertificateButton label="Obtener constancia consolidada"/);
  // El botón solo existe en la pantalla de resultados, que requiere la evaluación corregida por el backend.
  assert.equal(page.match(/Obtener constancia"/g).length, 1);
  assert.match(page, /phase === 'results' && attempt\?\.results && <Results/);
});
