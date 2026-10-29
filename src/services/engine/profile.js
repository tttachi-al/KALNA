import { COMPETENCIES } from '../../data/competencies.js';
import { evaluateEvidence } from './evidence.js';
import { extractCompetencies } from './extractor.js';

/**
 * Modelo del perfil de competencias (inmutable: cada función devuelve un perfil nuevo).
 *
 * Estados de una competencia:
 *  - 'evidencia'  → respaldada con un ejemplo concreto de la persona
 *  - 'declarada'  → la persona la mencionó al contar sus tareas o situaciones
 *  - 'por_validar'→ solo hay un indicio (por ejemplo, una herramienta que usa)
 *
 * Ningún estado equivale a una certificación.
 */
export const STATUS = {
  evidencia: { id: 'evidencia', label: 'Con evidencia', rank: 3 },
  declarada: { id: 'declarada', label: 'Declarada', rank: 2 },
  por_validar: { id: 'por_validar', label: 'Por validar', rank: 1 },
};

export const SOURCE_LABELS = {
  tareas: 'Tareas',
  herramientas: 'Herramientas',
  responsabilidades: 'Responsabilidades',
  situaciones: 'Situaciones resueltas',
  evidencia: 'En otro ejemplo',
  ampliar: 'Tareas',
  perfil: 'Perfil',
  entrevista: 'Entrevista',
};

export function createEmptyProfile() {
  return {
    alias: '',
    experience: { occupations: [], formality: null, duration: null },
    answers: {},
    competencies: {},
    dismissed: [],
    archive: {},
    target: null,
    routeProgress: {},
    updatedAt: null,
  };
}

/** Estado que corresponde a una mención según dónde apareció. */
function statusForSource(source) {
  return source === 'herramientas' ? 'por_validar' : 'declarada';
}

/**
 * Registra una mención de competencia. Devuelve { profile, isNew }.
 * Nunca baja un estado (por ejemplo, de "Con evidencia" a "Declarada").
 */
export function addMention(profile, id, quote, source) {
  if (!COMPETENCIES[id] || profile.dismissed.includes(id)) return { profile, isNew: false };
  const current = profile.competencies[id];
  const incoming = statusForSource(source);
  const mention = { quote, source };

  if (!current) {
    return {
      isNew: true,
      profile: {
        ...profile,
        competencies: {
          ...profile.competencies,
          [id]: { id, status: incoming, mentions: [mention], examples: [] },
        },
      },
    };
  }

  const status = STATUS[incoming].rank > STATUS[current.status].rank ? incoming : current.status;
  const alreadyQuoted = current.mentions.some((m) => m.quote === quote);
  return {
    isNew: false,
    profile: {
      ...profile,
      competencies: {
        ...profile.competencies,
        [id]: { ...current, status, mentions: alreadyQuoted ? current.mentions : [...current.mentions, mention] },
      },
    },
  };
}

/**
 * Revisa si el ejemplo habla de la competencia pedida. Si el texto solo
 * muestra OTRAS competencias, devuelve la primera para orientar a la persona.
 * Si no muestra ninguna, se le da el beneficio de la duda.
 */
export function evidenceMismatch(id, text) {
  const found = extractCompetencies(text).map((f) => f.id);
  if (!found.length || found.includes(id)) return null;
  return found[0];
}

/**
 * Agrega un ejemplo a una competencia y evalúa si la respalda.
 * Devuelve { profile, level, mismatch }.
 */
export function addExample(profile, id, text) {
  const current = profile.competencies[id];
  if (!current) return { profile, level: 'insuficiente', mismatch: null };
  let { level } = evaluateEvidence(text);
  const mismatch = level === 'fuerte' ? evidenceMismatch(id, text) : null;
  if (mismatch) level = 'parcial';
  const example = { text: text.trim(), level, at: new Date().toISOString() };
  let status = current.status;
  if (level === 'fuerte') status = 'evidencia';
  else if (level === 'parcial' && !mismatch && current.status === 'por_validar') status = 'declarada';

  return {
    level,
    mismatch,
    profile: {
      ...profile,
      competencies: {
        ...profile.competencies,
        [id]: { ...current, status, examples: [...current.examples, example] },
      },
    },
  };
}

/** La persona indica que una competencia no la representa. */
export function dismissCompetency(profile, id) {
  const { [id]: removed, ...rest } = profile.competencies;
  return {
    ...profile,
    competencies: rest,
    dismissed: [...new Set([...profile.dismissed, id])],
    archive: { ...(profile.archive || {}), ...(removed ? { [id]: removed } : {}) },
  };
}

/** Recupera una competencia quitada (con sus menciones y ejemplos, si existen). */
export function restoreDismissed(profile, id) {
  const { [id]: saved, ...archive } = profile.archive || {};
  return {
    ...profile,
    dismissed: profile.dismissed.filter((x) => x !== id),
    archive,
    competencies: saved ? { ...profile.competencies, [id]: saved } : profile.competencies,
  };
}

export function activeCompetencies(profile) {
  return Object.values(profile?.competencies || {});
}

export function statusCounts(profile) {
  const counts = { evidencia: 0, declarada: 0, por_validar: 0, total: 0 };
  for (const c of activeCompetencies(profile)) {
    counts[c.status] += 1;
    counts.total += 1;
  }
  return counts;
}

/** Mejor cita para mostrar como respaldo: ejemplo fuerte > ejemplo > mención. */
export function bestQuote(competency) {
  if (!competency) return null;
  const strong = competency.examples.find((e) => e.level === 'fuerte');
  if (strong) return { text: strong.text, kind: 'ejemplo' };
  if (competency.mentions.length) return { text: competency.mentions[0].quote, kind: 'mencion', source: competency.mentions[0].source };
  if (competency.examples.length) return { text: competency.examples.at(-1).text, kind: 'ejemplo-parcial' };
  return null;
}

export function hasProfile(profile) {
  return activeCompetencies(profile).length > 0;
}
