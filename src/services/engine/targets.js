import { JOBS } from '../../data/jobs.js';
import { OCCUPATIONS } from '../../data/occupations.js';
import { empleosPeruUrl } from '../config.js';

/**
 * Objetivo laboral de la persona: puede ser un PUESTO recomendado (data/jobs.js)
 * o una de las cinco ocupaciones de referencia. La ruta y el pasaporte trabajan
 * con esta forma común.
 */

export const GENERIC_REQUIREMENTS = [
  'Revisa en cada aviso los requisitos de experiencia, horario y documentos.',
  'Ten a la mano tu DNI y, si los tienes, constancias o certificados de trabajo.',
];

export const GENERIC_INTERVIEW = [
  '¿Qué tareas hacías en tu último trabajo y cómo las organizabas?',
  'Cuéntame una situación difícil que resolviste en el trabajo.',
  '¿Por qué te interesa este puesto?',
];

const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

/**
 * Meta a partir de un empleo recomendado por el servidor (forma de JobRecommendation).
 * Se usa para guardar en el perfil el puesto elegido desde su tarjeta.
 */
export function targetFromRecommendation(job) {
  const requires = [...(job.matches || []), ...(job.transferable || []), ...(job.gaps || [])].map((r) => ({ id: r.id, weight: r.weight }));
  return {
    id: job.jobId,
    kind: 'job',
    synthetic: Boolean(job.synthetic),
    name: job.name,
    area: job.area,
    summary: job.summary,
    requires,
    requirements: [...(job.pendingRequirements || []), ...(job.optionalRequirements || [])].map((r) => r.text),
  };
}

/**
 * @param {string} id
 * @param {object} [profile] si `profile.targetJob` es este puesto (elegido desde «Puestos»), se usa.
 * @returns {{ id, kind: 'job'|'occupation', name, area, summary, requires, requirements, interview, search, url } | null}
 */
export function getTarget(id, profile = null) {
  const occ = OCCUPATIONS[id];
  if (occ) {
    return {
      id,
      kind: 'occupation',
      name: occ.name,
      area: null,
      summary: occ.summary,
      requires: occ.requires,
      requirements: occ.requirements,
      interview: occ.interview,
      search: occ.name,
      url: empleosPeruUrl(occ.name),
    };
  }
  const job = JOB_BY_ID[id];
  if (!job) {
    const saved = profile?.targetJob?.id === id ? profile.targetJob : null;
    if (!saved) return null;
    // Empleo de referencia del servidor: se busca en Empleos Perú por su nombre (portal oficial,
    // no un aviso concreto).
    return {
      ...saved,
      kind: 'job',
      requirements: saved.requirements?.length ? saved.requirements : GENERIC_REQUIREMENTS,
      interview: GENERIC_INTERVIEW,
      search: saved.name,
      url: empleosPeruUrl(saved.name),
    };
  }
  return {
    id,
    kind: 'job',
    name: job.name,
    area: job.area,
    summary: job.summary,
    requires: job.requires,
    requirements: job.requirements || GENERIC_REQUIREMENTS,
    interview: job.interview || GENERIC_INTERVIEW,
    search: job.search,
    url: empleosPeruUrl(job.search),
  };
}
