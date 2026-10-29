import { COMPETENCIES } from '../../data/competencies.js';
import { OCCUPATIONS, OCCUPATION_IDS } from '../../data/occupations.js';
import { bestQuote } from './profile.js';
import { joinNames } from './text.js';

/**
 * Compara el perfil con las CINCO ocupaciones de referencia de KALLPA
 * (y, con la misma regla, con el catálogo de puestos de jobMatcher.js).
 *
 * Para cada ocupación devuelve:
 *  - matches:      competencias que coinciden con la experiencia (con su respaldo)
 *  - transferable: competencias que aún no aparecen, pero para las que la
 *                  persona tiene una BASE relacionada
 *  - gaps:         competencias o requisitos por desarrollar
 *  - why:          explicación en lenguaje simple
 *  - nextSteps:    próximos pasos para prepararse
 *
 * La "cercanía" es explicable (conteo de coincidencias). No es un dato de
 * demanda laboral ni una predicción de contratación.
 */

const STATUS_FACTOR = { evidencia: 1, declarada: 0.8, por_validar: 0.5 };
const WEIGHT = { clave: 1, complementaria: 0.5 };

/** Evalúa una lista de requisitos contra las competencias del perfil. */
export function evaluateRequirements(requires, own) {
  const matches = [];
  const transferable = [];
  const gaps = [];
  let score = 0;
  let max = 0;

  for (const req of requires) {
    const w = WEIGHT[req.weight];
    max += w;
    const mine = own[req.id];
    if (mine) {
      score += w * STATUS_FACTOR[mine.status];
      matches.push({ id: req.id, weight: req.weight, status: mine.status, quote: bestQuote(mine) });
      continue;
    }
    const base = COMPETENCIES[req.id].bases.find((b) => own[b.id]);
    if (base) {
      score += w * 0.35;
      transferable.push({ id: req.id, weight: req.weight, base: { id: base.id, why: base.why, status: own[base.id].status } });
    } else {
      gaps.push({ id: req.id, weight: req.weight });
    }
  }

  const ratio = max ? score / max : 0;
  const closeness = ratio >= 0.6 ? 'muy-cercana' : ratio >= 0.3 ? 'cercana' : 'por-explorar';
  return { matches, transferable, gaps, ratio, closeness };
}

export function compareOccupation(profile, occupationId) {
  const occ = OCCUPATIONS[occupationId];
  const own = profile?.competencies || {};
  const current = profile?.experience?.occupations || [];
  const { matches, transferable, gaps, ratio, closeness } = evaluateRequirements(occ.requires, own);
  const isCurrent = current.includes(occupationId);

  return {
    occupationId,
    isCurrent,
    matches,
    transferable,
    gaps,
    ratio,
    closeness,
    why: explain({ occ, isCurrent, matches, transferable, gaps }),
    nextSteps: nextSteps(occ, transferable, gaps, matches),
  };
}

export function compareAll(profile) {
  return OCCUPATION_IDS.map((id) => compareOccupation(profile, id));
}

export const CLOSENESS_SHORT = {
  'muy-cercana': 'Muy cercana',
  cercana: 'Cercana',
  'por-explorar': 'Por explorar',
};

export const CLOSENESS_LABELS = {
  'muy-cercana': 'Muy cercana a tu experiencia',
  cercana: 'Cercana a tu experiencia',
  'por-explorar': 'Por explorar',
};

const nameOf = (id) => COMPETENCIES[id].name.toLowerCase();

function explain({ occ, isCurrent, matches, transferable, gaps }) {
  const m = matches.map((x) => nameOf(x.id));
  const g = gaps.filter((x) => x.weight === 'clave').map((x) => nameOf(x.id));
  const t = transferable[0];

  if (isCurrent) {
    if (!gaps.length && !transferable.length) {
      return `Es tu ocupación actual y en tu relato aparecen sus competencias clave. Respaldarlas con ejemplos te ayudará a postular con más seguridad o a asumir más responsabilidades.`;
    }
    const pend = [...transferable.map((x) => nameOf(x.id)), ...g];
    return `Es tu ocupación actual. Ya reconoces ${m.length ? joinNames(m.slice(0, 3)) : 'parte de tu experiencia'}. Desarrollar ${joinNames(pend.slice(0, 2))} te ayudará a crecer en este mismo trabajo.`;
  }
  const mKey = matches.filter((x) => x.weight === 'clave').map((x) => nameOf(x.id));
  const mCompl = matches.filter((x) => x.weight !== 'clave').map((x) => nameOf(x.id));
  if (mKey.length) {
    const extra = t ? ` Además, ${nameOf(t.base.id)} es una buena base para aprender ${nameOf(t.id)}.` : '';
    return `Lo que contaste sobre ${joinNames(mKey.slice(0, 3))} también se usa como ${occ.name.toLowerCase()}.${extra}`;
  }
  if (transferable.length) {
    const bases = [...new Set(transferable.map((x) => nameOf(x.base.id)))].slice(0, 2);
    const targets = transferable.filter((x) => x.weight === 'clave').map((x) => nameOf(x.id)).slice(0, 2);
    const also = mCompl.length ? ` También coincide en ${joinNames(mCompl)}, que suma en este trabajo.` : '';
    return `Tu experiencia en ${joinNames(bases)} es una buena base para aprender ${joinNames(targets.length ? targets : [nameOf(t.id)])}, que son clave en esta ocupación.${also}`;
  }
  if (m.length) {
    return `Lo que contaste sobre ${joinNames(m)} también suma como ${occ.name.toLowerCase()}, aunque no es lo central del puesto.`;
  }
  return `Por ahora tu relato no muestra coincidencias con esta ocupación. Si te interesa, podrías empezar por ${g.length ? nameOf(gaps[0].id) : 'conocer sus tareas'}.`;
}

function nextSteps(occ, transferable, gaps, matches) {
  const steps = [];
  const pendingEvidence = matches.find((x) => x.status !== 'evidencia');
  if (pendingEvidence) {
    steps.push(`Agrega un ejemplo concreto de «${COMPETENCIES[pendingEvidence.id].name}» en tu perfil.`);
  }
  const priority = gaps.find((x) => x.weight === 'clave') || transferable[0] || gaps[0];
  if (priority) {
    steps.push(COMPETENCIES[priority.id].learn[0].text);
  }
  for (const s of occ.nextSteps) {
    if (steps.length >= 3) break;
    steps.push(s);
  }
  return steps;
}
