// Pruebas de la entrevista adaptativa con un modelo SIMULADO (`scriptedLlm`).
//
// Estas pruebas validan la lógica conversacional de KALLPA (validación,
// estado, reintentos, recuperación). NO prueban la calidad de QVAC: las
// salidas del "modelo" están escritas a mano. Las pruebas con QVAC real
// están en tests/qvac.live.test.js (KALLPA_QVAC_LIVE=1).
//
// Cada turno con respuesta usa dos llamadas: NOTAS y luego PREGUNTA.
// El turno de apertura usa solo PREGUNTA.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { advanceAdaptiveDiagnosis, startAdaptiveDiagnosis } from '../server/interview/flow.js';
import { createApp } from '../server/app.js';
import { LIMITS, REFERENCE_QUESTIONS } from '../server/interview/guide.js';
import { NOTES_TASK, QUESTION_TASK, SYSTEM_PROMPT } from '../server/interview/prompt.js';
import { NOTES_FORMAT, NOTES_SCHEMA, QUESTION_FORMAT, QUESTION_SCHEMA } from '../server/interview/schema.js';
import { createInterviewState, isLiteralQuote, looksLikeEpisode, redact } from '../server/interview/state.js';
import { referenceQuestion, runInterviewTurn } from '../server/interview/turn.js';
import { detailSupported, parseNotes, parseQuestion, reviewQuestion } from '../server/interview/validate.js';
import { LlmUnavailableError } from '../server/qvac/llm.js';

/* ───────── Utilidades ───────── */

const AREAS0 = { antes: 'pendiente', hoy: 'pendiente', cambios: 'pendiente', despues: 'pendiente' };

/** Salida de la tarea NOTAS. */
const notes = (o = {}) =>
  JSON.stringify({ evidencias: [], dijo: [], interpretaciones: [], falta_saber: [], seguimiento: [], ...o, areas: { ...AREAS0, ...o.areas } });

/** Salida de la tarea PREGUNTA. */
const ques = (pregunta, o = {}) => JSON.stringify({ accion: 'preguntar', area: 'hoy', tipo: 'experiencial', motivo: 'simulado', detalle: '', pregunta, ...o });

const NOTES0 = notes();

/** Modelo simulado: devuelve las salidas en orden y registra cada llamada. */
function scriptedLlm(outputs) {
  const calls = [];
  let i = 0;
  return {
    calls,
    describe: () => ({ engine: 'simulado', model: 'scripted', status: 'ready' }),
    async generate(params) {
      calls.push(params);
      const next = outputs[i++];
      if (next === undefined) throw new Error('scriptedLlm: no hay más salidas');
      if (next instanceof Error) throw next;
      return { text: next, model: 'scripted' };
    },
  };
}

const lastBlock = (call) => call.history.at(-1).content;
const dialogOf = (call) => call.history.filter((m) => m.role !== 'system');
const questionCalls = (llm) => llm.calls.filter((c) => c.responseFormat === QUESTION_FORMAT);
const notesCalls = (llm) => llm.calls.filter((c) => c.responseFormat === NOTES_FORMAT);

/** Ejecuta la apertura y varias respuestas; devuelve todos los resultados. */
async function play(llm, answers, { profile = {} } = {}) {
  let r = await runInterviewTurn({ state: createInterviewState(), profile, userText: null, llm });
  const results = [r];
  for (const a of answers) {
    r = await runInterviewTurn({ state: r.state, profile, userText: a, llm });
    results.push(r);
  }
  return results;
}

const OPEN = ques('¿Cómo aprendiste lo que haces hoy?', { area: 'antes' });
const ctxFor = (userTexts, extra = {}) => ({ prev: createInterviewState(), turns: userTexts.length, evidenceCount: 0, userTexts, opening: false, ...extra });
const review = (pregunta, o, ctx) => reviewQuestion(JSON.parse(ques(pregunta, o)), ctx);

/* ───────── Contrato con QVAC ───────── */

test('los esquemas se envían como responseFormat json_schema y exigen todos los campos', () => {
  assert.equal(NOTES_FORMAT.type, 'json_schema');
  assert.equal(QUESTION_FORMAT.type, 'json_schema');
  assert.equal(NOTES_FORMAT.json_schema.schema, NOTES_SCHEMA);
  assert.deepEqual(NOTES_SCHEMA.required, ['evidencias', 'dijo', 'interpretaciones', 'falta_saber', 'seguimiento', 'areas']);
  assert.deepEqual(QUESTION_SCHEMA.required, ['accion', 'area', 'tipo', 'motivo', 'detalle', 'pregunta']);
  for (const s of [NOTES_SCHEMA, QUESTION_SCHEMA]) assert.equal(s.additionalProperties, false);
});

test('los prompts incluyen las reglas y las áreas del taller', () => {
  for (const s of ['UNA sola pregunta', '¿Te gustaría certificar lo que sabes?', '¿Tienes miedo de perder tu trabajo?', 'Empleos Perú', 'Capacítate Perú', 'conocimiento = qué sabe', 'cualidad = cómo es']) {
    assert.ok(SYSTEM_PROMPT.includes(s), `falta: ${s}`);
  }
  for (const a of ['antes', 'hoy', 'cambios', 'despues']) assert.ok(SYSTEM_PROMPT.includes(`${a} —`));
  assert.match(NOTES_TASK, /REGISTRAR NOTAS/);
  assert.match(QUESTION_TASK, /FORMULAR LA SIGUIENTE PREGUNTA/);
});

test('instrucciones, diálogo y estado llegan separados; notas y pregunta son llamadas distintas', async () => {
  const llm = scriptedLlm([OPEN, NOTES0, ques('¿Quién te enseñó a limpiar oficinas?', { area: 'antes', tipo: 'contexto' })]);
  await play(llm, ['Aprendí limpiando oficinas.']);
  assert.equal(notesCalls(llm).length, 1);
  assert.equal(questionCalls(llm).length, 2);
  const h = questionCalls(llm)[1].history;
  assert.equal(h[0].role, 'system');
  assert.match(h[0].content, /entrevistador de KALLPA/);
  assert.deepEqual(dialogOf(questionCalls(llm)[1]).map((m) => m.role), ['assistant', 'user']);
  assert.equal(h.at(-1).role, 'system');
  assert.match(lastBlock(questionCalls(llm)[1]), /ESTADO DE LA ENTREVISTA/);
  assert.match(lastBlock(notesCalls(llm)[0]), /REGISTRAR NOTAS/);
});

/* ───────── Escenario 1: limpieza, aprendió trabajando ───────── */

test('[simulado] limpieza: seguimiento pertinente y separación de evidencia e interpretación', async () => {
  const a1 = 'Aprendí mirando a mi tía, ella limpiaba oficinas y me llevaba. Ahora limpio en una clínica.';
  const a2 = 'En la clínica es distinto. Una vez se derramó sangre en el pasillo y usé el protocolo: guantes, aislar la zona y lejía diluida. La enfermera me felicitó.';
  const llm = scriptedLlm([
    OPEN,
    notes({ dijo: [{ categoria: 'trayectoria', cita: 'Aprendí mirando a mi tía' }, { categoria: 'contexto', cita: 'Ahora limpio en una clínica' }], areas: { antes: 'parcial' } }),
    ques('Mencionaste que ahora limpias en una clínica. ¿Qué cambia allí respecto de las oficinas?', { accion: 'contrastar', tipo: 'contraste', detalle: 'limpio en una clínica' }),
    notes({
      dijo: [{ categoria: 'resultados', cita: 'La enfermera me felicitó' }],
      evidencias: [{ cita: 'usé el protocolo: guantes, aislar la zona y lejía diluida', accion: 'Aplicó un protocolo ante un derrame de sangre', resultado: 'La enfermera la felicitó' }],
      interpretaciones: [
        { tipo: 'competencia_potencial', texto: 'Aplica protocolos de bioseguridad ante derrames', cita_base: 'usé el protocolo: guantes, aislar la zona y lejía diluida' },
        { tipo: 'cualidad', texto: 'Parece cuidadosa', cita_base: 'En la clínica es distinto' },
        { tipo: 'competencia_potencial', texto: 'Es la mejor del equipo', cita_base: 'soy la mejor de todas' },
      ],
      falta_saber: ['Quién le enseñó el protocolo'],
    }),
    ques('Mencionaste el protocolo. ¿Dónde lo aprendiste?', { accion: 'profundizar', area: 'antes', tipo: 'profundizacion', detalle: 'usé el protocolo' }),
  ]);
  const [, r1, r2] = await play(llm, [a1, a2]);

  assert.equal(r1.origin, 'qvac');
  assert.match(r1.question.texto, /clínica/);
  assert.deepEqual(r1.state.dijo.map((d) => d.cita), ['Aprendí mirando a mi tía', 'Ahora limpio en una clínica']);

  const s = r2.state;
  assert.equal(s.evidencias.length, 1);
  const [comp, cual] = s.interpretaciones;
  assert.equal(comp.tipo, 'competencia_potencial');
  assert.equal(comp.respaldo, 'relato_concreto');
  assert.equal(comp.estado, 'hipotesis');
  assert.equal(cual.tipo, 'cualidad');
  assert.equal(cual.respaldo, 'solo_mencion');
  assert.equal(s.interpretaciones.length, 2, 'la cita inventada se descarta');
  assert.ok(s.log.at(-1).notas[0].descartes.some((d) => d.why === 'cita_no_literal'));
  assert.deepEqual(s.falta_saber, ['Quién le enseñó el protocolo']);
});

test('una cualidad, una tarea habitual o una afirmación sin relato concreto no quedan como evidencia ni competencia', async () => {
  const llm = scriptedLlm([
    OPEN,
    notes({
      evidencias: [{ cita: 'Acomodo la mercadería todos los días', accion: 'Acomoda mercadería', resultado: '' }],
      interpretaciones: [{ tipo: 'competencia_potencial', texto: 'Organización del almacén', cita_base: 'soy muy ordenada' }],
    }),
    ques('Cuéntame la última vez que ordenaste el almacén.', { accion: 'pedir_ejemplo', tipo: 'experiencial', detalle: 'soy muy ordenada' }),
  ]);
  const [, r] = await play(llm, ['Yo soy muy ordenada. Acomodo la mercadería todos los días.']);
  assert.equal(r.state.evidencias.length, 0);
  assert.ok(r.state.dijo.some((d) => d.cita === 'Acomodo la mercadería todos los días'), 'se conserva como algo que dijo');
  assert.equal(r.state.interpretaciones[0].tipo, 'habilidad');
  assert.equal(r.state.interpretaciones[0].respaldo, 'solo_mencion');
  const why = r.state.log.at(-1).notas[0].descartes.map((d) => d.why);
  assert.ok(why.includes('sin_relato_concreto'));
  assert.ok(why.includes('competencia_sin_evidencia'));
});

test('el indicio de relato concreto reconoce episodios y no descripciones habituales', () => {
  assert.ok(looksLikeEpisode('Una vez se derramó sangre en el pasillo'));
  assert.ok(looksLikeEpisode('Ayer llegó un camión de gaseosas'));
  assert.ok(!looksLikeEpisode('Acomodo la mercadería y atiendo a la gente'));
  assert.ok(!looksLikeEpisode('Les hablo bajito y los escucho'));
});

/* ───────── Escenario 2: organiza mercadería y atiende clientes ───────── */

test('[simulado] mercadería y clientes: respuesta general → se pide un ejemplo; dos preguntas a la vez se rechazan', async () => {
  const llm = scriptedLlm([
    OPEN,
    notes({ dijo: [{ categoria: 'tareas', cita: 'Acomodo la mercadería y atiendo a la gente' }] }),
    ques('¿Cómo acomodas la mercadería? ¿Y cómo atiendes a los clientes?'),
    ques('Cuéntame la última vez que un cliente buscaba algo que no encontraba.', { accion: 'pedir_ejemplo', detalle: 'atiendo a la gente' }),
  ]);
  const [, r] = await play(llm, ['Acomodo la mercadería y atiendo a la gente.']);
  assert.equal(questionCalls(llm).length, 3, 'reintentó la pregunta una vez');
  assert.match(lastBlock(questionCalls(llm)[2]), /mas_de_una_pregunta/);
  assert.equal(r.origin, 'qvac');
  assert.equal(r.question.accion, 'pedir_ejemplo');
  assert.deepEqual(r.state.log.at(-1).pregunta.map((x) => x.rechazos), [['mas_de_una_pregunta'], []]);
});

/* ───────── Escenario 3: le bajaron las horas ───────── */

test('[simulado] horas reducidas: no presupone emociones y puede cambiar de dirección y retomar', async () => {
  const llm = scriptedLlm([
    OPEN,
    NOTES0,
    ques('Cuéntame cómo es un día típico en tu trabajo.'),
    notes({ dijo: [{ categoria: 'barreras', cita: 'desde marzo me bajaron los turnos de seis a tres días' }] }),
    ques('¿Tienes miedo de perder tu trabajo?', { accion: 'profundizar', area: 'cambios', tipo: 'profundizacion', detalle: 'me bajaron los turnos' }),
    ques('Mencionaste que te bajaron los turnos. ¿Qué hiciste cuando pasó eso?', { accion: 'profundizar', area: 'cambios', tipo: 'comportamiento', detalle: 'me bajaron los turnos' }),
    notes({ dijo: [{ categoria: 'canales', cita: 'Empecé a vender comida los fines de semana' }], areas: { cambios: 'parcial' } }),
    ques('Volviendo a la tienda, ¿qué cosas te piden a ti porque saben que las haces bien?', { accion: 'retomar', tipo: 'contexto' }),
  ]);
  const [, , r2, r3] = await play(llm, [
    'Aprendí en la tienda de mi primo.',
    'Reponía y cobraba, pero desde marzo me bajaron los turnos de seis a tres días.',
    'Empecé a vender comida los fines de semana.',
  ]);
  assert.equal(r2.question.area, 'cambios', 'cambió de dirección');
  assert.match(lastBlock(questionCalls(llm)[3]), /presupone_una_emocion/);
  assert.doesNotMatch(r2.question.texto, /miedo/);
  assert.equal(r3.question.accion, 'retomar');
  assert.equal(r3.question.area, 'hoy');
});

test('si la persona menciona una emoción, se puede retomar con sus palabras', () => {
  const o = { accion: 'profundizar', area: 'cambios', tipo: 'profundizacion', detalle: 'me da miedo' };
  assert.deepEqual(review('¿Qué te da miedo de esa situación?', o, ctxFor(['Me da miedo que cierren la tienda'])), []);
  assert.ok(review('¿Qué te da miedo de esa situación?', { ...o, detalle: 'cierren la tienda' }, ctxFor(['Cierran la tienda en enero'])).includes('presupone_una_emocion'));
});

/* ───────── Escenario 4: tiene trabajo y busca alternativas ───────── */

test('[simulado] con trabajo y buscando alternativas: rechaza preguntas sesgadas; Empleos Perú solo en "después"', () => {
  const ctx = ctxFor(['Trabajo en planilla en un supermercado como cajera. Estoy bien, pero quiero ver otras opciones.']);
  const r = (pregunta, o = {}) => review(pregunta, o, ctx);

  assert.ok(r('¿Te gustaría certificar lo que sabes?').includes('sugiere_certificarse'));
  assert.ok(r('¿Usarías una aplicación para buscar trabajo?').includes('introduce_una_aplicacion'));
  assert.ok(r('¿Te falta capacitación para cambiar?').includes('asume_falta_de_capacitacion'));
  assert.ok(r('¿Hace cuánto estás desempleada?').includes('presupone_desempleo'));
  assert.ok(r('Es difícil, ¿verdad?').includes('pide_confirmar_hipotesis'));
  assert.ok(r('Se nota que eres muy responsable. ¿Qué opciones ves?').includes('presenta_interpretacion_como_hecho'));
  assert.ok(r('¿Conoces Empleos Perú?', { area: 'hoy' }).includes('introduce_servicio_antes_de_tiempo'));
  // Retomar sus propias palabras ("planilla") y preguntar por servicios en "después" sí es válido.
  assert.deepEqual(r('¿Qué te lleva a mirar otras opciones estando en planilla?', { area: 'despues', tipo: 'profundizacion' }), []);
  assert.deepEqual(r('¿Has usado Empleos Perú alguna vez?', { area: 'despues', tipo: 'experiencial' }), []);
});

/* ───────── Escenario 5: respuestas breves o ambiguas ───────── */

test('[simulado] respuesta ambigua: aclaración neutral; un cierre prematuro se rechaza y se usa la guía', async () => {
  const close = ques('', { accion: 'cerrar', tipo: 'cierre' });
  const llm = scriptedLlm([
    OPEN,
    NOTES0,
    ques('¿Qué fue lo último que hiciste en tu trabajo, por ejemplo ayer?', { accion: 'aclarar', tipo: 'aclaracion', detalle: 'de todo un poco' }),
    NOTES0,
    close,
    close,
  ]);
  const [, r1, r2] = await play(llm, ['no sé, de todo un poco', 'lo normal']);
  assert.equal(r1.question.accion, 'aclarar');
  assert.equal(r1.origin, 'qvac');
  assert.equal(r2.close, false);
  assert.equal(r2.origin, 'guia');
  assert.ok(Object.values(REFERENCE_QUESTIONS).flat().some((q) => q.text === r2.question.texto));
  assert.ok(!r2.state.preguntas.slice(0, -1).some((p) => p.texto === r2.question.texto), 'la guía no repite preguntas');
  assert.deepEqual(r2.state.log.at(-1).pregunta.map((x) => x.rechazos), [['cierre_prematuro'], ['cierre_prematuro']]);
});

test('salidas vacías o con JSON inválido no se muestran', async () => {
  assert.equal(parseQuestion('').error, 'respuesta_vacia');
  assert.equal(parseQuestion('hola').error, 'json_invalido');
  assert.equal(parseNotes('{"dijo": []}').error, 'campo_evidencias_invalido');
  assert.ok(parseQuestion(`Aquí está: ${ques('¿Qué haces?')}`).ok);

  const llm = scriptedLlm(['', 'no es json']);
  const r = await runInterviewTurn({ state: createInterviewState(), profile: {}, userText: null, llm });
  assert.equal(r.origin, 'guia');
  assert.equal(r.question.texto, REFERENCE_QUESTIONS.antes[0].text);
});

test('si las notas fallan, la entrevista sigue y no se registra nada inventado', async () => {
  const llm = scriptedLlm([OPEN, 'no es json', '{}', ques('¿Quién te enseñó?', { area: 'antes', tipo: 'contexto' })]);
  const [, r] = await play(llm, ['Aprendí con mi abuela.']);
  assert.equal(r.origin, 'qvac');
  assert.equal(r.state.dijo.length, 0);
  assert.deepEqual(r.state.log.at(-1).notas.map((x) => x.rechazos), [['json_invalido'], ['campo_dijo_invalido']]);
});

/* ───────── Escenario 6: experiencia inesperada o contradicción ───────── */

test('[simulado] contradicción: profundiza con contraste (con sus palabras) y la registra como tensión', async () => {
  const a1 = 'Trabajo en una bodega, pero no me gusta atender gente.';
  const a2 = 'Lo que más me piden es que atienda a los clientes difíciles porque yo los calmo.';
  const llm = scriptedLlm([
    OPEN,
    notes({ dijo: [{ categoria: 'motivaciones', cita: 'no me gusta atender gente' }] }),
    ques('¿Qué cosas te piden hacer a ti porque saben que las haces bien?', { tipo: 'contexto' }),
    notes({
      dijo: [{ categoria: 'habilidades', cita: 'atienda a los clientes difíciles porque yo los calmo' }],
      interpretaciones: [{ tipo: 'tension', texto: 'Dice que no le gusta atender gente, pero la buscan para calmar a clientes difíciles', cita_base: 'atienda a los clientes difíciles porque yo los calmo' }],
    }),
    // "detalle" con otra conjugación: se acepta porque sale de sus palabras.
    ques('Me contaste que no te gusta atender gente y que te piden calmar a clientes difíciles. ¿Qué diferencia hay entre esas dos cosas?', {
      accion: 'contrastar',
      tipo: 'contraste',
      detalle: 'atiendo a la gente',
    }),
  ]);
  const [, , r] = await play(llm, [a1, a2]);
  assert.equal(r.origin, 'qvac');
  assert.equal(r.question.tipo, 'contraste');
  const t = r.state.interpretaciones[0];
  assert.equal(t.tipo, 'tension');
  assert.equal(t.estado, 'hipotesis');
});

test('un seguimiento debe apoyarse en lo que dijo la persona', () => {
  const ctx = ctxFor(['Reponía y cobraba en una bodega.']);
  assert.ok(review('¿Qué pasó?', { accion: 'profundizar', detalle: '' }, ctx).includes('seguimiento_sin_detalle'));
  assert.ok(review('¿Cómo manejabas el inventario?', { accion: 'profundizar', detalle: 'manejaba el inventario' }, ctx).includes('detalle_sin_respaldo'));
  assert.deepEqual(review('¿Cómo cobrabas?', { accion: 'profundizar', detalle: 'cobraba' }, ctx), []);
  assert.ok(detailSupported('atiendo a la gente', ['no me gusta atender gente']));
  assert.ok(!detailSupported('manejo del inventario', ['Reponía y cobraba']));
});

/* ───────── Repetición, contexto entre turnos y cierre ───────── */

test('no repite preguntas ya hechas ni copia la respuesta', async () => {
  const llm = scriptedLlm([
    OPEN,
    NOTES0,
    ques('¿Cómo aprendiste lo que haces hoy?', { area: 'antes' }),
    ques('¿Quién te enseñó a cobrar?', { area: 'antes', tipo: 'contexto' }),
  ]);
  const [, r] = await play(llm, ['Aprendí cobrando en la caja de mi mamá.']);
  assert.match(lastBlock(questionCalls(llm)[2]), /pregunta_repetida/);
  assert.equal(r.question.texto, '¿Quién te enseñó a cobrar?');

  const answer = 'Ayer llegó un camión de gaseosas y tuve que contar las cajas';
  assert.ok(review(`Cuéntame: ${answer}.`, {}, ctxFor([answer])).includes('copia_la_respuesta'));
});

test('conserva el contexto: cada turno recibe el diálogo previo y el estado acumulado', async () => {
  const answers = ['Aprendí en un mercado.', 'Ahora cobro en una farmacia.', 'Una vez cuadré la caja que no cerraba.'];
  const llm = scriptedLlm([
    OPEN,
    notes({ dijo: [{ categoria: 'trayectoria', cita: 'Aprendí en un mercado' }] }),
    ques('¿Qué hacías en el mercado?', { area: 'antes' }),
    notes({ dijo: [{ categoria: 'contexto', cita: 'cobro en una farmacia' }] }),
    ques('Cuéntame una vez que resolviste un problema en la farmacia.'),
    notes({ evidencias: [{ cita: 'cuadré la caja que no cerraba', accion: 'Cuadró la caja', resultado: '' }] }),
    ques('¿Cómo encontraste la diferencia?', { accion: 'profundizar', tipo: 'profundizacion', detalle: 'cuadré la caja' }),
  ]);
  const rs = await play(llm, answers);
  const last = questionCalls(llm).at(-1);
  assert.deepEqual(dialogOf(last).filter((m) => m.role === 'user').map((m) => m.content), answers);
  const block = lastBlock(last);
  assert.match(block, /Aprendí en un mercado/);
  assert.match(block, /cobro en una farmacia/);
  assert.match(block, /cuadré la caja que no cerraba/);
  assert.match(block, /¿Qué hacías en el mercado\?/);
  assert.match(block, /ya relata un hecho concreto/, 'la pista de episodio llega a la tarea de pregunta');
  assert.equal(rs.at(-1).state.evidencias.length, 1);
});

test('cierra cuando hay información suficiente y nunca pasa del límite de turnos', async () => {
  const ev = notes({ evidencias: [{ cita: 'ayer limpié el almacén entero', accion: 'Limpió el almacén', resultado: '' }] });
  const qs = ['¿Qué hiciste primero?', '¿Quién te pidió hacerlo?', 'Cuéntame cómo es un día típico.'];
  const llm = scriptedLlm([OPEN, ...qs.flatMap((q) => [ev, ques(q)]), NOTES0, ques('', { accion: 'cerrar', tipo: 'cierre' })]);
  const rs = await play(llm, ['ayer limpié el almacén entero', 'Primero saqué todo', 'El dueño', 'Llego, barro y ordeno']);
  assert.equal(rs.at(-1).close, true);
  assert.equal(rs.at(-1).state.endedBy, 'entrevistador');

  // Tope de turnos: aunque el modelo siga preguntando, el código cierra.
  const words = ['baños', 'pasillos', 'vidrios', 'cocina', 'almacén', 'oficinas', 'escaleras', 'patio', 'ascensor', 'recepción', 'jardín', 'cochera', 'terraza'];
  const llm2 = scriptedLlm([OPEN, ...words.slice(0, LIMITS.maxTurns).flatMap((w) => [NOTES0, ques(`¿Cómo limpias ${w}?`)])]);
  const rs2 = await play(llm2, Array.from({ length: LIMITS.maxTurns }, (_, i) => `respuesta ${i}`));
  assert.equal(rs2.at(-1).close, true);
  assert.equal(rs2.at(-1).state.endedBy, 'limite');
});

test('[simulado] no cierra justo cuando la persona abre un tema nuevo (por ejemplo, le bajaron las horas)', async () => {
  const ev = notes({ evidencias: [{ cita: 'ayer limpié el almacén entero', accion: 'Limpió el almacén', resultado: '' }] });
  const close = ques('', { accion: 'cerrar', tipo: 'cierre' });
  const llm = scriptedLlm([
    OPEN,
    ...['¿Qué hiciste primero?', '¿Quién te pidió hacerlo?', 'Cuéntame cómo es un día típico.'].flatMap((q) => [ev, ques(q)]),
    notes({ dijo: [{ categoria: 'barreras', cita: 'Desde agosto me bajaron las horas' }] }),
    close,
    ques('Mencionaste que te bajaron las horas. ¿Qué hiciste cuando pasó eso?', { accion: 'profundizar', area: 'cambios', tipo: 'comportamiento', detalle: 'me bajaron las horas' }),
  ]);
  const rs = await play(llm, ['ayer limpié el almacén entero', 'Primero saqué todo', 'El dueño', 'Desde agosto me bajaron las horas porque contrataron una empresa.']);
  const r = rs.at(-1);
  assert.equal(r.close, false);
  assert.equal(r.question.area, 'cambios');
  assert.deepEqual(r.state.log.at(-1).pregunta.map((x) => x.rechazos), [['cierre_con_tema_nuevo'], []]);

  // Si el modelo no da una pregunta válida, la guía también sigue el tema nuevo.
  const st = { ...createInterviewState(), areas: { antes: 'parcial', hoy: 'parcial', cambios: 'pendiente', despues: 'pendiente' } };
  assert.equal(referenceQuestion(st, 'cambios').area, 'cambios');
  assert.equal(referenceQuestion(st).area, 'cambios', 'sin tema nuevo: primero las áreas pendientes');
});

test('quita datos personales antes de enviarlos al modelo o guardarlos', async () => {
  assert.equal(redact('mi DNI es 45678912 y mi cel 987 654 321'), 'mi DNI es [dato omitido] y mi cel [dato omitido]');
  const llm = scriptedLlm([OPEN, NOTES0, ques('¿Qué haces en la tienda?')]);
  const [, r] = await play(llm, ['Trabajo en una tienda, mi correo es rosa@mail.com']);
  for (const c of llm.calls) assert.doesNotMatch(JSON.stringify(c.history), /rosa@mail\.com/);
  assert.doesNotMatch(JSON.stringify(r.state), /rosa@mail\.com/);
  assert.ok(isLiteralQuote('mi correo es', r.state.dialog.filter((m) => m.role === 'user').map((m) => m.content)));
});

/* ───────── Flujo completo y recuperación tras errores ───────── */

async function toTiempo(llm) {
  let r = startAdaptiveDiagnosis();
  for (const input of [{ choices: ['empezar'] }, { text: 'Rosa' }, { choices: ['limpieza'] }, { choices: ['informal'] }]) {
    r = await advanceAdaptiveDiagnosis(r.session, input, { llm });
  }
  return r;
}

test('[simulado] flujo: los datos básicos siguen el motor y luego empieza la entrevista con QVAC', async () => {
  const llm = scriptedLlm([OPEN]);
  const before = await toTiempo(llm);
  assert.equal(before.session.stage, 'tiempo');
  assert.equal(llm.calls.length, 0, 'los datos básicos no usan el modelo');
  const r = await advanceAdaptiveDiagnosis(before.session, { choices: ['mas5'] }, { llm });
  assert.equal(r.session.stage, 'entrevista');
  assert.equal(r.messages.at(-1).text, '¿Cómo aprendiste lo que haces hoy?');
  assert.equal(r.messages.at(-1).data.interview.origen, 'qvac');
  assert.ok(!r.messages.some((m) => /Cuéntame qué hacías en un día normal/.test(m.text)), 'no queda la pregunta fija de "tareas"');
  assert.equal(r.ui.progress.current, 1);
  assert.match(lastBlock(llm.calls[0]), /Personal de limpieza/);
  assert.match(lastBlock(llm.calls[0]), /Más de 5 años/);
});

test('[simulado] recuperación: si QVAC falla, la sesión no cambia y el reintento continúa', async () => {
  const llm = scriptedLlm([
    OPEN,
    new LlmUnavailableError('QVAC no está disponible: el modelo todavía se está cargando (40%).'),
    NOTES0,
    ques('¿Quién te enseñó?', { area: 'antes', tipo: 'contexto' }),
  ]);
  const pre = await toTiempo(llm);
  const { session } = await advanceAdaptiveDiagnosis(pre.session, { choices: ['mas5'] }, { llm });
  const snapshot = structuredClone(session);

  await assert.rejects(advanceAdaptiveDiagnosis(session, { text: 'Aprendí con mi vecina.' }, { llm }), LlmUnavailableError);
  assert.deepEqual(session, snapshot, 'la sesión no se modificó');

  const r = await advanceAdaptiveDiagnosis(session, { text: 'Aprendí con mi vecina.' }, { llm });
  assert.equal(r.session.interview.turns, 1);
  assert.equal(r.session.messages.filter((m) => m.text === 'Aprendí con mi vecina.').length, 1, 'la respuesta no se duplica');
});

test('[simulado] API: 503 reintentable y conversación retomada tras reiniciar el servidor', async () => {
  const failing = scriptedLlm([OPEN, new LlmUnavailableError('QVAC no respondió en 60 s.')]);
  const app = createApp({ llm: failing });
  let r = await app('POST', '/diagnosis/start', null);
  for (const input of [{ choices: ['empezar'] }, { text: 'Luis' }, { choices: ['reponedor'] }, { choices: ['formal'] }, { choices: ['1a3'] }]) {
    r = await app('POST', `/diagnosis/${r.session.id}/answer`, { input });
  }
  assert.equal(r.session.stage, 'entrevista');
  await assert.rejects(app('POST', `/diagnosis/${r.session.id}/answer`, { input: { text: 'Repongo anaqueles.' } }), (e) => e.status === 503 && e.extra.retryable);

  // "Reinicio": un servidor nuevo no conoce la sesión, pero el navegador envía su copia.
  const fresh = createApp({ llm: scriptedLlm([NOTES0, ques('¿Cómo repones los anaqueles?')]) });
  await assert.rejects(fresh('POST', `/diagnosis/${r.session.id}/answer`, { input: { text: 'x' } }), (e) => e.status === 404);
  const resumed = await fresh('POST', `/diagnosis/${r.session.id}/answer`, { input: { text: 'Repongo anaqueles.' }, session: r.session });
  assert.equal(resumed.session.interview.turns, 1);
  assert.equal(resumed.messages.at(-1).text, '¿Cómo repones los anaqueles?');
});

test('[simulado] al cerrar la entrevista se pasa a los ejemplos del motor o al final', async () => {
  const ev = notes({ evidencias: [{ cita: 'el lunes revisé qué insumos faltaban y avisé a la supervisora', accion: 'Revisó insumos', resultado: '' }] });
  const qs = ['¿Cada cuánto lo revisas?', '¿Qué haces cuando falta algo urgente?', '¿Qué te gustaría cambiar de tu trabajo?'];
  const llm = scriptedLlm([OPEN, ...qs.flatMap((q) => [ev, ques(q)]), NOTES0, ques('', { accion: 'cerrar', tipo: 'cierre' })]);
  const pre = await toTiempo(llm);
  let r = await advanceAdaptiveDiagnosis(pre.session, { choices: ['mas5'] }, { llm });
  for (const text of ['Cada semana reviso qué insumos faltan; el lunes revisé qué insumos faltaban y avisé a la supervisora.', 'Los lunes.', 'Llamo a la supervisora.', 'Más horas.']) {
    r = await advanceAdaptiveDiagnosis(r.session, { text }, { llm });
  }
  assert.ok(['evidencia', 'fin'].includes(r.session.stage));
  assert.equal(r.session.interview.done, true);
  assert.ok(r.session.profile.competencies.control_suministros, 'el motor de reglas sigue alimentando el perfil');
  assert.equal(r.session.profile.competencies.control_suministros.status, 'declarada');
});

test('la persona puede terminar la entrevista cuando quiera (tras dos respuestas)', async () => {
  const llm = scriptedLlm([OPEN, NOTES0, ques('¿Qué haces primero?'), NOTES0, ques('¿Y después?')]);
  const pre = await toTiempo(llm);
  let r = await advanceAdaptiveDiagnosis(pre.session, { choices: ['mas5'] }, { llm });
  assert.equal(r.ui.allowSkip, false);
  r = await advanceAdaptiveDiagnosis(r.session, { text: 'Limpio baños.' }, { llm });
  r = await advanceAdaptiveDiagnosis(r.session, { text: 'Y pasillos.' }, { llm });
  assert.equal(r.ui.allowSkip, true);
  r = await advanceAdaptiveDiagnosis(r.session, { skip: true }, { llm });
  assert.equal(r.session.interview.endedBy, 'persona');
  assert.notEqual(r.session.stage, 'entrevista');
});
