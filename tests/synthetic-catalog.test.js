// Catálogo sintético de empleos (sin PostgreSQL): una sola colección plana
// de 50 empleos distintos, válidos y sin enlaces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COMPETENCIES } from '../src/data/competencies.js';
import { CATALOG_SIZE, SYNTHETIC_JOBS, validateCatalog } from '../server/catalog/synthetic.js';

test('el catálogo es válido: exactamente 50 empleos con ids y nombres únicos', () => {
  assert.deepEqual(validateCatalog(), []);
  assert.equal(SYNTHETIC_JOBS.length, CATALOG_SIZE);
  assert.equal(new Set(SYNTHETIC_JOBS.map((j) => j.id)).size, 50);
  assert.equal(new Set(SYNTHETIC_JOBS.map((j) => j.title.toLowerCase())).size, 50);
});

test('es una sola colección plana, sin agrupaciones por perfiles o categorías', () => {
  const src = readFileSync(new URL('../server/catalog/synthetic-jobs.js', import.meta.url), 'utf8');
  assert.equal((src.match(/^export const /gm) || []).length, 1, 'un solo array exportado');
  for (const j of SYNTHETIC_JOBS) {
    for (const k of ['primaryProfile', 'profile', 'profiles', 'segment', 'group', 'also', 'why']) assert.ok(!(k in j), `${j.id} tiene el campo de agrupación ${k}`);
  }
});

test('cada empleo tiene id, nombre, descripción, funciones y competencias del catálogo', () => {
  for (const j of SYNTHETIC_JOBS) {
    assert.ok(j.id && j.title && j.description.length >= 120, j.id);
    assert.ok(j.tasks.length >= 3, j.id);
    assert.ok(j.competencies.some((c) => c.weight === 'clave'), j.id);
    for (const c of j.competencies) assert.ok(COMPETENCIES[c.id], `${j.id}: ${c.id}`);
    assert.ok(!/https?:\/\/|www\./i.test(JSON.stringify(j)), j.id);
  }
});

test('hay variedad de sectores, niveles y competencias (no 50 variantes del mismo puesto)', () => {
  assert.ok(new Set(SYNTHETIC_JOBS.map((j) => j.sector)).size >= 25);
  assert.deepEqual([...new Set(SYNTHETIC_JOBS.map((j) => j.level))].sort(), ['operativo', 'supervision', 'tecnico']);
  assert.equal(new Set(SYNTHETIC_JOBS.flatMap((j) => j.competencies.map((c) => c.id))).size, Object.keys(COMPETENCIES).length);
});

test('cada competencia del catálogo es clave en al menos dos empleos (selección de 50)', () => {
  for (const id of Object.keys(COMPETENCIES)) {
    const n = SYNTHETIC_JOBS.filter((j) => j.competencies.some((c) => c.id === id && c.weight === 'clave')).length;
    assert.ok(n >= 2, `${id} es clave en ${n} empleos`);
  }
});

test('la validación detecta tamaño incorrecto, duplicados, competencias inventadas y enlaces', () => {
  const base = SYNTHETIC_JOBS;
  assert.ok(validateCatalog(base.slice(1)).some((e) => /exactamente 50/.test(e)));
  assert.ok(validateCatalog([...base.slice(1), { ...base[1] }]).some((e) => /id repetido/.test(e)));
  const inventada = base.map((j, i) => (i === 0 ? { ...j, competencies: [...j.competencies, { id: 'liderazgo', weight: 'clave' }] } : j));
  assert.ok(validateCatalog(inventada).some((e) => /fuera del catálogo/.test(e)));
  const enlace = base.map((j, i) => (i === 0 ? { ...j, description: `${j.description} https://ejemplo.pe/oferta` } : j));
  assert.ok(validateCatalog(enlace).some((e) => /enlace/.test(e)));
  const copia = base.map((j, i) => (i === 1 ? { ...j, tasks: base[0].tasks } : j));
  assert.ok(validateCatalog(copia).some((e) => /posible duplicado/.test(e)));
});
