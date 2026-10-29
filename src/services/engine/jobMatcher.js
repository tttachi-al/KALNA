import { JOBS } from '../../data/jobs.js';
import { empleosPeruUrl } from '../config.js';
import { evaluateRequirements } from './matcher.js';

/**
 * Recomienda los puestos del catálogo que mejor encajan con el perfil,
 * con la misma regla explicable que la comparación de ocupaciones.
 * No son vacantes: cada recomendación enlaza a Empleos Perú para ver ofertas vigentes.
 *
 * @returns {{ jobId, name, area, summary, search, url, matches, transferable, gaps, ratio, closeness }[]}
 */
export function recommendJobs(profile, limit = 3) {
  const own = profile?.competencies || {};
  return JOBS.map((job) => {
    const r = evaluateRequirements(job.requires, own);
    return {
      jobId: job.id,
      name: job.name,
      area: job.area,
      summary: job.summary,
      search: job.search,
      url: empleosPeruUrl(job.search),
      ...r,
    };
  })
    .filter((j) => j.matches.length > 0)
    .sort((a, b) => b.ratio - a.ratio || b.matches.length - a.matches.length)
    .slice(0, limit);
}
