import { COMPETENCIES } from '../../data/competencies.js';
import { RESOURCES } from '../../data/resources.js';
import { evaluateRequirements } from './matcher.js';
import { getTarget } from './targets.js';

/**
 * Genera una ruta laboral personalizada hacia un objetivo: un puesto recomendado
 * o una de las cinco ocupaciones de referencia (ver targets.js).
 *
 * Prioridad de brechas:
 *   alta  → competencia clave sin base previa
 *   media → competencia clave con base transferible (adaptar lo que ya sabes)
 *   baja  → competencia complementaria
 */
export const PRIORITY_LABELS = {
  alta: 'Prioridad alta',
  media: 'Prioridad media',
  baja: 'Prioridad baja',
};

/**
 * @param {object} profile
 * @param {string} targetId
 * @param {object} [target] meta ya resuelta (el servidor la construye desde PostgreSQL)
 */
export function buildRoute(profile, targetId, target = null) {
  const occ = target || getTarget(targetId, profile);
  if (!occ) return null;
  const own = profile?.competencies || {};
  const cmp = {
    ...evaluateRequirements(occ.requires, own),
    isCurrent: (profile?.experience?.occupations || []).includes(targetId),
  };

  const gapItems = [
    ...cmp.gaps.map((g) => ({ ...g, priority: g.weight === 'clave' ? 'alta' : 'baja', base: null })),
    ...cmp.transferable.map((t) => ({ ...t, priority: t.weight === 'clave' ? 'media' : 'baja' })),
  ].sort((a, b) => rank(a.priority) - rank(b.priority));

  const stages = [
    {
      id: 'respalda',
      title: 'Respalda lo que ya sabes',
      description: 'Tus competencias valen más cuando tienen ejemplos y referencias.',
      items: [
        ...cmp.matches
          .filter((m) => m.status !== 'evidencia')
          .map((m) => ({
            id: `respalda-${m.id}`,
            title: `Agrega un ejemplo de «${COMPETENCIES[m.id].name}»`,
            detail: COMPETENCIES[m.id].ask,
            competencyId: m.id,
            action: { label: 'Agregar ejemplo', to: `/perfil?c=${m.id}` },
          })),
        {
          id: 'respalda-referencia',
          title: 'Consigue una referencia laboral',
          detail: 'Pide a un exjefe, supervisor o cliente frecuente que confirme lo que hacías. Sirve también para trabajos informales.',
        },
      ],
    },
    {
      id: 'desarrolla',
      title: 'Desarrolla tus brechas prioritarias',
      description: gapItems.length
        ? 'Empieza por las de prioridad alta. Las de prioridad media se apoyan en algo que ya sabes.'
        : 'En este modelo de referencia no hay brechas para este objetivo. Sigue practicando y respaldando tus competencias.',
      items: gapItems.map((g) => ({
        id: `desarrolla-${g.id}`,
        title: `Desarrolla «${COMPETENCIES[g.id].name}»`,
        detail: g.base ? g.base.why : COMPETENCIES[g.id].description,
        competencyId: g.id,
        priority: g.priority,
        baseId: g.base?.id || null,
        activities: COMPETENCIES[g.id].learn,
        resource: COMPETENCIES[g.id].learn.some((l) => l.type === 'curso') ? RESOURCES.capacitacion : null,
      })),
    },
    {
      id: 'prepara',
      title: 'Prepara tu postulación',
      description: 'Ordena tu información para contar tu experiencia con seguridad.',
      items: [
        {
          id: 'prepara-pasaporte',
          title: `Revisa tu pasaporte para «${occ.name}»`,
          detail: 'Úsalo como guía para tu CV: empieza por las competencias que pide el puesto, con un ejemplo cada una.',
          action: { label: 'Ver pasaporte', to: '/pasaporte' },
        },
        {
          id: 'prepara-entrevista',
          title: 'Practica preguntas de entrevista',
          detail: 'Responde en voz alta usando ejemplos reales de tu trabajo.',
          list: occ.interview,
        },
        {
          id: 'prepara-requisitos',
          title: 'Conoce requisitos frecuentes',
          detail: 'Son orientativos: cada aviso puede pedir cosas distintas.',
          list: occ.requirements,
        },
      ],
    },
    {
      id: 'postula',
      title: 'Busca y postula',
      description: 'Kalna no muestra vacantes: te orienta para buscarlas en portales oficiales.',
      items: [
        {
          id: 'postula-buscar',
          title: `Busca avisos de «${occ.name}»`,
          detail: `Busca «${occ.search}» en ${RESOURCES.empleos.name} y revisa las ofertas vigentes.`,
          resource: { ...RESOURCES.empleos, url: occ.url },
        },
        {
          id: 'postula-comparar',
          title: 'Compara cada aviso con tu pasaporte',
          detail: 'Marca qué requisitos ya cumples y cuáles podrías explicar con ejemplos.',
        },
        {
          id: 'postula-registro',
          title: 'Anota a dónde postulaste',
          detail: 'Fecha, lugar y respuesta. Te ayudará a hacer seguimiento.',
        },
      ],
    },
  ];

  const total = stages.reduce((n, st) => n + st.items.length, 0);
  return {
    occupationId: targetId,
    target: occ,
    comparison: cmp,
    priorityGaps: gapItems.slice(0, 3),
    stages,
    total,
  };
}

function rank(p) {
  return { alta: 0, media: 1, baja: 2 }[p];
}

export function routeProgress(route, progressMap = {}) {
  const ids = route.stages.flatMap((s) => s.items.map((i) => i.id));
  const done = ids.filter((id) => progressMap[id]).length;
  return { done, total: ids.length, ratio: ids.length ? done / ids.length : 0 };
}
