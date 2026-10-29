// «Crear mi ruta» sin QVAC ni PostgreSQL: reglas (plan.js), validación de la
// redacción del modelo (personalize.js) y coherencia con el destino elegido.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OCCUPATIONS } from '../src/data/occupations.js';
import { SYNTHETIC_JOBS } from '../server/catalog/synthetic-jobs.js';
import { evaluateJob } from '../server/matching/compatibility.js';
import { checkActivity, personalizeRoute } from '../server/route/personalize.js';
import { buildRoutePlan, classify } from '../server/route/plan.js';

const own = (entries) => new Map(entries.map(([id, status, quote = `cita de ${id}`]) => [id, { status, quotes: [quote] }]));
/** Destino a partir de un empleo sintético del catálogo (como lo carga el servidor). */
function destinationOf(id) {
  const j = SYNTHETIC_JOBS.find((x) => x.id === id);
  return {
    id: j.id,
    name: j.title,
    sector: j.sector,
    summary: j.description,
    synthetic: true,
    requires: j.competencies,
    requirements: j.requirements,
    interview: j.tasks.slice(0, 3).map((t) => `¿Cómo lo harías?: ${t}`),
  };
}
const plan = (destination, ownMap, extra = {}) => buildRoutePlan({ destination, evaluation: evaluateJob({ job: destination, own: ownMap, ...extra }) });
const items = (route) => route.stages.flatMap((s) => s.items);
const LIMPIEZA = destinationOf('sint_limpieza_oficinas');
const ALMACEN = destinationOf('sint_auxiliar_almacen');

/* ───────── Clasificación ───────── */

test('clasifica cubierta / reforzar / desarrollar y asigna prioridades por reglas', () => {
  // limpieza_oficinas: protocolos, uso_productos, org_materiales (clave) + control_suministros (complementaria)
  const ev = evaluateJob({
    job: LIMPIEZA,
    own: own([['protocolos', 'evidencia'], ['uso_productos', 'declarada'], ['control_existencias', 'evidencia']]),
    possible: new Map([['org_materiales', { quote: 'guardaba las escobas en su sitio', similarity: 0.6 }]]),
  });
  const c = Object.fromEntries(classify(ev, LIMPIEZA).map((x) => [x.competencyId, x]));
  assert.equal(c.protocolos.state, 'cubierta');
  assert.equal(c.protocolos.priority, null);
  assert.deepEqual([c.uso_productos.state, c.uso_productos.reason, c.uso_productos.priority], ['reforzar', 'sin_ejemplo', 'media']);
  assert.deepEqual([c.org_materiales.state, c.org_materiales.reason], ['reforzar', 'por_confirmar'], 'una similitud no la cubre: queda por confirmar');
  // control_suministros: base control_existencias → desarrollar con base, complementaria → baja
  assert.deepEqual([c.control_suministros.state, c.control_suministros.base?.id, c.control_suministros.priority], ['desarrollar', 'control_existencias', 'baja']);
});

test('una competencia clave que falta sin base es prioridad alta; con base, media', () => {
  const noBase = classify(evaluateJob({ job: ALMACEN, own: own([]) }), ALMACEN).find((x) => x.competencyId === 'recepcion_mercaderia');
  assert.deepEqual([noBase.state, noBase.priority], ['desarrollar', 'alta']);
  const withBase = classify(evaluateJob({ job: ALMACEN, own: own([['control_suministros', 'evidencia']]) }), ALMACEN).find((x) => x.competencyId === 'recepcion_mercaderia');
  assert.deepEqual([withBase.state, withBase.base?.id, withBase.priority], ['desarrollar', 'control_suministros', 'media']);
});

/* ───────── Estructura de la ruta ───────── */

test('cuatro etapas; cada actividad tiene objetivo, por qué, acción y criterio de finalización', () => {
  const r = plan(LIMPIEZA, own([['protocolos', 'declarada']]));
  assert.deepEqual(r.stages.map((s) => s.id), ['respalda', 'desarrolla', 'prepara', 'postula']);
  for (const it of items(r)) {
    for (const f of ['id', 'title', 'objective', 'why', 'action', 'doneWhen']) assert.ok(typeof it[f] === 'string' && it[f].length > 5, `${it.id}.${f}`);
  }
  assert.equal(new Set(items(r).map((i) => i.id)).size, items(r).length, 'ids únicos');
  assert.equal(r.total, items(r).length);
});

test('se eliminan actividades innecesarias para el perfil', () => {
  const all = plan(LIMPIEZA, own([['protocolos', 'evidencia'], ['uso_productos', 'evidencia'], ['org_materiales', 'evidencia'], ['control_suministros', 'evidencia']]));
  assert.ok(!items(all).some((i) => i.id.startsWith('desarrolla-')), 'nada que desarrollar');
  assert.ok(!items(all).some((i) => i.id.startsWith('respalda-') && i.id !== 'respalda-referencia'), 'nada que respaldar con ejemplos');
  assert.ok(!all.stages.some((s) => s.id === 'desarrolla'), 'la etapa vacía no aparece');
  const none = plan(LIMPIEZA, own([]));
  assert.ok(!items(none).some((i) => i.id === 'respalda-referencia'), 'sin competencias que respaldar no se pide una referencia');
  const noReq = plan({ ...ALMACEN, requirements: [] }, own([]));
  assert.ok(!items(noReq).some((i) => i.id === 'prepara-requisitos'));
});

test('las brechas se ordenan por prioridad (alta → media → baja)', () => {
  const r = plan(ALMACEN, own([['control_suministros', 'evidencia']]));
  const des = r.stages.find((s) => s.id === 'desarrolla').items.map((i) => i.priority);
  const rank = { alta: 0, media: 1, baja: 2 };
  assert.deepEqual(des, [...des].sort((a, b) => rank[a] - rank[b]));
});

test('requisitos obligatorios aparecen para verificar, sin darlos por cumplidos ni incumplidos', () => {
  const mont = destinationOf('sint_montacarguista');
  const it = items(plan(mont, own([['recepcion_mercaderia', 'evidencia']]))).find((i) => i.id === 'prepara-requisitos');
  assert.ok(it.list.some((t) => /montacargas/i.test(t)));
  assert.match(it.doneWhen, /lo tengo|conseguirlo/);
});

/* ───────── Coherencia con el destino ───────── */

test('la ruta corresponde siempre al puesto elegido (limpieza de oficinas ≠ reponedor)', () => {
  const profile = own([['protocolos', 'declarada'], ['reposicion', 'evidencia'], ['org_productos', 'evidencia']]);
  const r = plan(LIMPIEZA, profile);
  assert.equal(r.occupationId, 'sint_limpieza_oficinas');
  assert.equal(r.target.name, LIMPIEZA.name);
  const allowed = new Set(LIMPIEZA.requires.map((x) => x.id));
  for (const it of items(r)) if (it.competencyId) assert.ok(allowed.has(it.competencyId), `${it.id} no pertenece al destino`);
  const text = JSON.stringify(r.stages);
  assert.ok(!/reponedor|abastecedor/i.test(text), 'sin actividades ni nombres de la ocupación de reponedor');
  assert.ok(!items(r).some((i) => i.id === 'desarrolla-reposicion' || i.id === 'respalda-reposicion'), 'sin actividades de competencias que el destino no pide');
  // Una competencia del perfil puede citarse solo como BASE para desarrollar otra que el destino sí pide.
  for (const it of items(r)) if (it.baseId) assert.ok(profile.has(it.baseId) && allowed.has(it.competencyId));
  assert.ok(text.includes(LIMPIEZA.name));
});

test('cambiar de destino genera una ruta coherente con el nuevo puesto', () => {
  const profile = own([['protocolos', 'declarada'], ['org_productos', 'evidencia']]);
  const a = plan(LIMPIEZA, profile);
  const b = plan(ALMACEN, profile);
  assert.notDeepEqual(items(a).map((i) => i.id), items(b).map((i) => i.id));
  const allowedB = new Set(ALMACEN.requires.map((x) => x.id));
  assert.ok(items(b).filter((i) => i.competencyId).every((i) => allowedB.has(i.competencyId)));
  assert.ok(JSON.stringify(b.stages).includes(ALMACEN.name) && !JSON.stringify(b.stages).includes(LIMPIEZA.name));
});

test('una transferencia por similitud se explica sin mostrar cifras internas', () => {
  const sim = (a, b) => (a === 'reposicion' && b === 'org_materiales' ? 0.84 : undefined);
  const r = buildRoutePlan({ destination: LIMPIEZA, evaluation: evaluateJob({ job: LIMPIEZA, own: own([['reposicion', 'evidencia']]), similarity: sim }) });
  const it = items(r).find((i) => i.id === 'desarrolla-org_materiales');
  assert.equal(it.baseId, 'reposicion');
  assert.ok(!/similitud|0[.,]\d/.test(it.why), it.why);
});

test('dos perfiles distintos obtienen rutas personalizadas distintas para el mismo puesto', () => {
  const novata = plan(LIMPIEZA, own([['atencion_cliente', 'declarada']]));
  const experta = plan(LIMPIEZA, own([['protocolos', 'evidencia'], ['uso_productos', 'declarada'], ['org_materiales', 'evidencia']]));
  const ids = (r) => items(r).map((i) => i.id);
  assert.notDeepEqual(ids(novata), ids(experta));
  assert.ok(ids(novata).includes('desarrolla-protocolos'));
  assert.ok(!ids(experta).includes('desarrolla-protocolos'));
  assert.ok(ids(experta).includes('respalda-uso_productos'));
});

test('ocupaciones de referencia también funcionan como destino', () => {
  const occ = OCCUPATIONS.cajero;
  const r = plan({ id: 'cajero', name: occ.name, summary: occ.summary, requires: occ.requires, requirements: [], interview: occ.interview }, own([['manejo_dinero', 'evidencia']]));
  assert.equal(r.occupationId, 'cajero');
  assert.ok(items(r).find((i) => i.id === 'prepara-entrevista').list.length === occ.interview.length);
});

/* ───────── Redacción con el modelo (validación) ───────── */

const route = plan(LIMPIEZA, own([['protocolos', 'declarada'], ['control_existencias', 'evidencia']]));
const llmReturning = (fn) => ({ calls: 0, async generate(p) { this.calls += 1; return { text: JSON.stringify({ activities: fn(p) }) }; } });
const rewriteAll = (extra = {}) =>
  items(route).map((i) => ({ id: i.id, objective: `Objetivo claro: ${i.title}`, why: `Importa para el puesto de destino porque lo pide el trabajo diario.`, action: `Hazlo con calma y anota lo que hiciste en un cuaderno.`, ...(extra[i.id] || {}) }));

test('acepta una redacción válida y conserva estructura, ids, prioridades y criterio de finalización', async () => {
  const { route: out, personalization } = await personalizeRoute({ route, profile: {}, llm: llmReturning(() => rewriteAll()) });
  assert.equal(personalization.ok, true);
  assert.equal(personalization.accepted, items(route).length);
  assert.deepEqual(items(out).map((i) => [i.id, i.priority, i.doneWhen]), items(route).map((i) => [i.id, i.priority, i.doneWhen]));
  assert.ok(items(out).every((i) => i.personalized));
});

test('rechaza (y deja la plantilla) lo que inventa cursos, enlaces, cifras o competencias ajenas', async () => {
  const [a, b, c, d] = items(route).map((i) => i.id);
  const bad = {
    [a]: { action: 'Inscríbete en el curso gratuito de limpieza profesional del instituto.' },
    [b]: { why: 'Más información en https://ejemplo.pe sobre este puesto de trabajo.' },
    [c]: { objective: 'Lograrlo en 15 días como máximo, sin falta.' },
    [d]: { why: 'Te sirve para practicar también Ventas y Cálculo de vuelto con tus vecinos.' },
  };
  const { route: out, personalization } = await personalizeRoute({ route, profile: {}, llm: llmReturning(() => rewriteAll(bad)) });
  const why = Object.fromEntries(personalization.rejected.map((r) => [r.id, r.why]));
  assert.match(why[a], /contenido_nuevo/);
  assert.match(why[b], /contenido_nuevo/);
  assert.match(why[c], /cifra_nueva/);
  assert.match(why[d], /competencia_ajena/);
  for (const id of [a, b, c, d]) assert.deepEqual(items(out).find((i) => i.id === id), items(route).find((i) => i.id === id), `${id} queda con la plantilla`);
});

test('si el modelo falla o no hay modelo, la ruta queda con las plantillas', async () => {
  const failing = { async generate() { const e = new Error('QVAC no respondió en 60 s.'); e.retryable = true; throw e; } };
  const r1 = await personalizeRoute({ route, profile: {}, llm: failing });
  assert.deepEqual([r1.personalization.ok, r1.personalization.reason], [false, 'qvac_no_disponible']);
  assert.deepEqual(r1.route, route);
  const r2 = await personalizeRoute({ route, profile: {}, llm: null });
  assert.equal(r2.personalization.engine, 'plantilla');
});

test('la acción de «desarrolla» (práctica del catálogo) no se reescribe; la primera persona se rechaza', async () => {
  const dev = items(route).find((i) => i.id.startsWith('desarrolla-'));
  const other = items(route).find((i) => !i.id.startsWith('desarrolla-'));
  const { route: out } = await personalizeRoute({
    route,
    profile: {},
    llm: llmReturning(() => rewriteAll({ [dev.id]: { action: 'Describe paso a paso otra tarea distinta que hiciste en tu trabajo.' }, [other.id]: { objective: 'Contar cómo cumplí mi tarea de cada día.' } })),
  });
  const devOut = items(out).find((i) => i.id === dev.id);
  assert.equal(devOut.action, dev.action, 'la práctica del catálogo se conserva');
  assert.notEqual(devOut.objective, dev.objective, 'el objetivo sí se personaliza');
  assert.deepEqual(items(out).find((i) => i.id === other.id), other, 'en primera persona: queda la plantilla');
});

test('checkActivity permite repetir lo que ya estaba en la plantilla', () => {
  const it = items(plan(destinationOf('sint_montacarguista'), own([]))).find((i) => i.id === 'prepara-requisitos');
  assert.equal(checkActivity(it, { objective: 'Saber si tienes el certificado que piden.', why: 'El puesto pide un certificado de operador.', action: 'Revisa si tienes el certificado de montacargas vigente.' }, new Set()), null);
});

test('dos peticiones iguales a la vez comparten una sola generación con el modelo', async () => {
  const { createRouteService } = await import('../server/route/service.js');
  const recommender = { compare: async (_p, job) => ({ result: evaluateJob({ job, own: own([['manejo_dinero', 'evidencia']]) }) }) };
  const llm = { calls: 0, async generate() { this.calls += 1; await new Promise((r) => setTimeout(r, 30)); throw Object.assign(new Error('x'), { retryable: true }); } };
  const svc = createRouteService({ recommender, llm });
  const profile = { competencies: { manejo_dinero: { id: 'manejo_dinero', status: 'evidencia', mentions: [], examples: [] } } };
  const [a, b] = await Promise.all([svc.build(profile, 'cajero'), svc.build(profile, 'cajero')]);
  assert.equal(llm.calls, 1);
  assert.equal(a.occupationId, 'cajero');
  assert.deepEqual(a.stages, b.stages);
  await assert.rejects(svc.build(profile, 'no_existe'), (e) => e.status === 404);
});
