import { COMPETENCIES } from '../../src/data/competencies.js';
import { normalize } from '../../src/services/engine/text.js';
import { SYNTHETIC_JOBS } from './synthetic-jobs.js';

/**
 * Validación del catálogo sintético de empleos (colección plana, sin grupos).
 */
export { SYNTHETIC_JOBS };
export const CATALOG_VERSION = 'sintetico-v2';
export const CATALOG_SIZE = 50;

const LEVELS = new Set(['operativo', 'tecnico', 'supervision']);
const REQUIREMENT_KINDS = new Set(['educacion', 'experiencia', 'certificacion', 'licencia', 'formacion', 'condicion']);

const words = (list) => new Set(list.flatMap((t) => normalize(t).split(/\W+/).filter((w) => w.length > 3)));
const jaccard = (a, b) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
};

/** Comprueba el catálogo. Devuelve la lista de problemas (vacía si es válido). */
export function validateCatalog(jobs = SYNTHETIC_JOBS) {
  const errors = [];
  if (jobs.length !== CATALOG_SIZE) errors.push(`hay ${jobs.length} empleos (se esperaban exactamente ${CATALOG_SIZE})`);
  const ids = new Set();
  const titles = new Set();
  for (const j of jobs) {
    if (!/^sint_[a-z0-9_]+$/.test(j.id || '')) errors.push(`id inválido: ${j.id}`);
    if (ids.has(j.id)) errors.push(`id repetido: ${j.id}`);
    ids.add(j.id);
    const t = normalize(j.title || '');
    if (!t) errors.push(`${j.id}: falta nombre`);
    if (titles.has(t)) errors.push(`nombre repetido: ${j.title}`);
    titles.add(t);
    if ((j.description || '').length < 120) errors.push(`${j.id}: descripción demasiado corta`);
    if (!Array.isArray(j.tasks) || j.tasks.length < 3) errors.push(`${j.id}: menos de 3 funciones principales`);
    if (!Array.isArray(j.responsibilities) || j.responsibilities.length < 2) errors.push(`${j.id}: menos de 2 responsabilidades`);
    if (!j.sector) errors.push(`${j.id}: falta sector`);
    if (!LEVELS.has(j.level)) errors.push(`${j.id}: nivel inválido ${j.level}`);
    const comps = j.competencies || [];
    if (!comps.some((c) => c.weight === 'clave')) errors.push(`${j.id}: sin competencias clave`);
    if (new Set(comps.map((c) => c.id)).size !== comps.length) errors.push(`${j.id}: competencia repetida`);
    for (const c of comps) {
      if (!COMPETENCIES[c.id]) errors.push(`${j.id}: competencia fuera del catálogo ${c.id}`);
      if (!['clave', 'complementaria'].includes(c.weight)) errors.push(`${j.id}: peso inválido ${c.weight}`);
    }
    for (const r of j.requirements || []) {
      if (!REQUIREMENT_KINDS.has(r.kind) || !r.text || typeof r.mandatory !== 'boolean') errors.push(`${j.id}: requisito inválido`);
    }
    if (/https?:\/\/|www\./i.test(JSON.stringify(j))) errors.push(`${j.id}: contiene un enlace (los empleos sintéticos no enlazan a ofertas)`);
  }
  // Puestos casi idénticos con nombres distintos: funciones muy parecidas.
  for (let i = 0; i < jobs.length; i += 1) {
    for (let k = i + 1; k < jobs.length; k += 1) {
      const s = jaccard(words(jobs[i].tasks || []), words(jobs[k].tasks || []));
      if (s >= 0.6) errors.push(`posible duplicado: ${jobs[i].id} y ${jobs[k].id} (funciones ${Math.round(s * 100)} % iguales)`);
    }
  }
  return errors;
}
