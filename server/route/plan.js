import { COMPETENCIES } from '../../src/data/competencies.js';
import { RESOURCES } from '../../src/data/resources.js';

/**
 * Ruta laboral: REGLAS de negocio (sin modelo). Recibe el destino y la
 * comparación ya calculada (server/matching/compatibility.js) y decide:
 *
 *  1. Clasificación de cada competencia requerida por el destino:
 *     - cubierta     tiene la competencia con evidencia concreta
 *     - reforzar     la tiene declarada o por validar, o una evidencia se le parece
 *                    («por confirmar»): falta un ejemplo concreto
 *     - desarrollar  no la tiene (con o sin una base transferible)
 *     Una similitud semántica nunca la convierte en «cubierta».
 *  2. Prioridad: alta = clave sin base · media = clave por reforzar o con base ·
 *     baja = complementaria.
 *  3. Cuatro etapas con actividades (objetivo, por qué, acción, criterio de
 *     finalización). Solo se incluyen las que tienen sentido para este perfil y
 *     este destino, ordenadas por prioridad. Ids estables: el progreso se
 *     conserva aunque la ruta se regenere.
 *
 * Todo sale del destino (catálogo/PostgreSQL), del catálogo de competencias y
 * del perfil: no se inventan competencias, cursos ni ofertas.
 */
export const ROUTE_RULES_VERSION = 'ruta-v2';
export const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 };
const WEIGHT_LABEL = { clave: 'clave', complementaria: 'complementaria' };

const name = (id) => COMPETENCIES[id]?.name || id;
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const quoteOf = (q) => (q ? ` (contaste: «${q.length > 120 ? `${q.slice(0, 117)}…` : q}»)` : '');

/** Clasifica cada competencia requerida por el destino. */
export function classify(evaluation, destination) {
  const out = [];
  for (const req of destination.requires) {
    const m = evaluation.matches.find((x) => x.id === req.id);
    const t = evaluation.transferable.find((x) => x.id === req.id);
    const p = evaluation.possible.find((x) => x.id === req.id);
    let item;
    if (m && m.status === 'evidencia') item = { state: 'cubierta', status: m.status, quote: m.quote };
    else if (m) item = { state: 'reforzar', status: m.status, quote: m.quote, reason: 'sin_ejemplo' };
    else if (p) item = { state: 'reforzar', status: null, quote: p.quote, reason: 'por_confirmar' };
    else if (t) item = { state: 'desarrollar', base: { id: t.from.id, why: t.why, via: t.via, status: t.from.status } };
    else item = { state: 'desarrollar', base: null };
    const priority =
      req.weight === 'complementaria' ? 'baja' : item.state === 'desarrollar' && !item.base ? 'alta' : item.state === 'cubierta' ? null : 'media';
    out.push({ competencyId: req.id, weight: req.weight, priority, ...item });
  }
  return out;
}

const byPriority = (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || (a.weight === 'clave' ? 0 : 1) - (b.weight === 'clave' ? 0 : 1);

/** Construye la ruta (sin redacción del modelo). */
export function buildRoutePlan({ destination, evaluation }) {
  const classes = classify(evaluation, destination);
  const covered = classes.filter((c) => c.state === 'cubierta');
  const reinforce = classes.filter((c) => c.state === 'reforzar').sort(byPriority);
  const develop = classes.filter((c) => c.state === 'desarrollar').sort(byPriority);
  const dest = destination.name;
  const keyNames = destination.requires.filter((r) => r.weight === 'clave').map((r) => name(r.id));
  const pending = (destination.requirements || []).filter((r) => r.mandatory);

  const respalda = [
    ...reinforce.map((c) => ({
      id: `respalda-${c.competencyId}`,
      competencyId: c.competencyId,
      priority: c.priority,
      title: `Respalda «${name(c.competencyId)}» con un ejemplo`,
      objective: `Que «${name(c.competencyId)}» figure con evidencia en tu perfil.`,
      why:
        c.reason === 'por_confirmar'
          ? `«${dest}» la pide como competencia ${WEIGHT_LABEL[c.weight]}. Algo de lo que contaste se parece${quoteOf(c.quote)}, pero falta confirmarla.`
          : `«${dest}» la pide como competencia ${WEIGHT_LABEL[c.weight]} y hoy figura como ${c.status === 'declarada' ? 'declarada' : 'por validar'}${quoteOf(c.quote)}.`,
      action: COMPETENCIES[c.competencyId].ask,
      doneWhen: 'Agregaste en tu perfil un ejemplo concreto (qué hiciste, cuándo y qué resultado tuvo) y la competencia figura «Con evidencia».',
      link: { label: 'Agregar ejemplo', to: `/perfil?c=${c.competencyId}` },
    })),
  ];
  if (covered.length || reinforce.some((c) => c.reason === 'sin_ejemplo')) {
    const names = [...covered, ...reinforce.filter((c) => c.reason === 'sin_ejemplo')].map((c) => name(c.competencyId));
    respalda.push({
      id: 'respalda-referencia',
      priority: 'baja',
      title: 'Consigue una referencia de tu experiencia',
      objective: 'Tener a una persona que confirme lo que sabes hacer.',
      why: `Una referencia respalda ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' y otras' : ''} ante quien te entreviste, también si tu experiencia fue informal.`,
      action: 'Pide a un exjefe, supervisor, compañero o cliente frecuente que pueda contar lo que hacías y anota su nombre y teléfono.',
      doneWhen: 'Tienes al menos una persona que aceptó darte una referencia y sus datos de contacto.',
    });
  }

  const desarrolla = develop.map((c) => {
    const learn = COMPETENCIES[c.competencyId].learn || [];
    const first = learn.find((l) => l.type === 'practica') || learn[0];
    return {
      id: `desarrolla-${c.competencyId}`,
      competencyId: c.competencyId,
      priority: c.priority,
      baseId: c.base?.id || null,
      title: `Desarrolla «${name(c.competencyId)}»`,
      objective: `Empezar a practicar «${name(c.competencyId)}» para poder contar un ejemplo.`,
      why: !c.base
        ? `«${dest}» la pide (${WEIGHT_LABEL[c.weight]}) y todavía no aparece en tu perfil.`
        : c.base.via === 'bases'
          ? `«${dest}» la pide (${WEIGHT_LABEL[c.weight]}). Puedes apoyarte en lo que ya sabes de «${name(c.base.id)}»: ${lower(c.base.why)}`
          : `«${dest}» la pide (${WEIGHT_LABEL[c.weight]}). Se parece a algo que ya sabes hacer, «${name(c.base.id)}», así que no empiezas de cero.`,
      action: first ? first.text : COMPETENCIES[c.competencyId].description,
      doneWhen: 'Hiciste la práctica al menos una vez y anotaste un ejemplo concreto que puedas contar.',
      activities: learn,
      resource: learn.some((l) => l.type === 'curso') ? RESOURCES.capacitacion : null,
    };
  });

  const prepara = [
    {
      id: 'prepara-pasaporte',
      priority: 'media',
      title: `Ordena tu pasaporte para «${dest}»`,
      objective: 'Tener una presentación de tus competencias pensada para este puesto.',
      why: `El puesto pide sobre todo: ${keyNames.join(', ')}. Conviene que tu pasaporte empiece por ellas, cada una con un ejemplo.`,
      action: 'Abre tu pasaporte, revisa que las competencias que pide el puesto estén primero y que cada una tenga un ejemplo claro.',
      doneWhen: 'Tu pasaporte muestra primero las competencias del puesto y lo descargaste o imprimiste.',
      link: { label: 'Ver pasaporte', to: '/pasaporte' },
    },
  ];
  if (destination.interview?.length) {
    prepara.push({
      id: 'prepara-entrevista',
      priority: 'media',
      title: 'Practica preguntas de entrevista',
      objective: 'Responder con seguridad usando ejemplos reales.',
      why: `Son preguntas sobre las tareas de «${dest}».`,
      action: 'Responde en voz alta cada pregunta con un ejemplo de tu experiencia: qué hiciste, cómo y qué resultado tuvo.',
      doneWhen: 'Respondiste todas las preguntas en voz alta con un ejemplo cada una.',
      list: destination.interview,
    });
  }
  if (pending.length) {
    prepara.push({
      id: 'prepara-requisitos',
      priority: 'alta',
      title: 'Verifica los requisitos del puesto',
      objective: 'Saber si cumples cada requisito o cómo conseguirlo.',
      why: 'Son requisitos que no se pueden saber por tu conversación: hay que verificarlos antes de postular.',
      action: 'Revisa cada requisito y anota si ya lo tienes (con su documento) o qué necesitas para conseguirlo.',
      doneWhen: 'Cada requisito de la lista está marcado como «lo tengo» o con un paso para conseguirlo.',
      list: pending.map((r) => r.text),
    });
  }

  const postula = [
    {
      id: 'postula-buscar',
      priority: 'media',
      title: `Busca avisos parecidos a «${dest}»`,
      objective: 'Encontrar ofertas vigentes para este tipo de puesto.',
      why: 'KALLPA no publica vacantes: las ofertas vigentes están en el portal oficial del MTPE.',
      action: `Busca «${dest}» (o nombres parecidos) en ${RESOURCES.empleos.name} y guarda los avisos que te interesen.`,
      doneWhen: 'Guardaste al menos dos avisos vigentes que se parezcan a este puesto.',
      resource: RESOURCES.empleos,
    },
    {
      id: 'postula-comparar',
      priority: 'media',
      title: 'Compara cada aviso con tu perfil',
      objective: 'Decidir a qué avisos postular y qué destacar en cada uno.',
      why: 'Cada aviso pide cosas distintas; comparar te ayuda a postular donde más encajas.',
      action: `Para cada aviso, marca qué competencias ya respaldas${pending.length ? ' y qué requisitos cumples' : ''} y cuáles podrías explicar con ejemplos.`,
      doneWhen: 'Tienes la comparación de cada aviso guardado y elegiste a cuáles postular.',
      list: keyNames,
    },
    {
      id: 'postula-registro',
      priority: 'baja',
      title: 'Anota a dónde postulaste',
      objective: 'Hacer seguimiento a tus postulaciones.',
      why: 'Llevar un registro evita perder respuestas y te ayuda a ver qué funciona.',
      action: 'Anota la fecha, el lugar, el puesto y la respuesta de cada postulación.',
      doneWhen: 'Tienes registradas todas tus postulaciones con su fecha.',
    },
  ];

  const sort = (items) => [...items].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3));
  const stages = [
    { id: 'respalda', title: 'Respalda lo que ya sabes', description: 'Tus competencias valen más cuando tienen ejemplos y referencias.', items: sort(respalda) },
    {
      id: 'desarrolla',
      title: 'Desarrolla tus brechas prioritarias',
      description: desarrolla.length ? 'Empieza por las de prioridad alta. Las de prioridad media se apoyan en algo que ya sabes.' : 'Para este puesto no hay competencias por desarrollar en tu perfil.',
      items: desarrolla,
    },
    { id: 'prepara', title: 'Prepara tu postulación', description: 'Ordena tu información para contar tu experiencia con seguridad.', items: sort(prepara) },
    { id: 'postula', title: 'Busca y postula', description: 'KALLPA no muestra vacantes: te orienta para buscarlas en el portal oficial.', items: postula },
  ].filter((s) => s.items.length);

  return {
    occupationId: destination.id,
    target: { id: destination.id, name: destination.name, sector: destination.sector || null, summary: destination.summary, synthetic: Boolean(destination.synthetic) },
    comparison: { ...evaluation, isCurrent: false },
    classification: classes,
    priorityGaps: [...develop, ...reinforce].sort(byPriority).slice(0, 3).map((c) => ({ id: c.competencyId, priority: c.priority, weight: c.weight, state: c.state })),
    stages,
    total: stages.reduce((n, s) => n + s.items.length, 0),
    rulesVersion: ROUTE_RULES_VERSION,
  };
}
