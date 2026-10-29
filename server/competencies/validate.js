import { COMPETENCIES } from '../../src/data/competencies.js';
import { maskOccupationWords, normalize } from '../../src/services/engine/text.js';
import { comparable, isLiteralQuote, looksLikeEpisode } from '../interview/state.js';
import { LEVELS, LIMITS, NO_LEVEL, QUOTE_TYPES, STATUSES } from './schema.js';

/**
 * Validación del análisis de competencias. El modelo PROPONE; estas reglas
 * DECIDEN qué entra al perfil:
 *
 *   1. Solo ids del catálogo que la persona no haya descartado.
 *   2. Cada cita debe aparecer literalmente en una respuesta de la persona y
 *      decir algo más que el nombre de una ocupación.
 *   3. Una competencia sin ninguna cita válida se descarta.
 *   4. «evidencia» exige una cita de tipo ejemplo_concreto que relate un hecho
 *      concreto (mismo detector que la entrevista); si no, baja a «declarada».
 *      «declarada» exige una afirmación o un ejemplo; con solo indicios queda
 *      «por_validar». El código nunca sube el estado que propuso el modelo.
 *   5. El nivel solo se conserva si el estado final es «evidencia» y viene
 *      con su justificación; si no, es null.
 *   6. Una misma cita no respalda más de tres competencias.
 */
const RANK = { por_validar: 1, declarada: 2, evidencia: 3 };

/** JSON de la respuesta (admite texto alrededor del objeto). */
export function parseAnalysis(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, error: 'respuesta_vacia' };
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    try {
      value = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : undefined;
    } catch {
      value = undefined;
    }
  }
  if (!value || typeof value !== 'object') return { ok: false, error: 'json_invalido' };
  if (!Array.isArray(value.competencies)) return { ok: false, error: 'falta_competencies' };
  if (!Array.isArray(value.missing_information)) return { ok: false, error: 'falta_missing_information' };
  return { ok: true, value };
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** ¿La cita dice algo más que el nombre de una ocupación o un lugar? */
function beyondOccupation(quote) {
  const rest = maskOccupationWords(normalize(quote)).replace(/\[puesto\]/g, ' ');
  return comparable(rest).split(' ').filter((w) => w.length > 2).length >= 2;
}

/** Estado que permiten las citas válidas, sin superar el que propuso el modelo. */
function decideStatus(proposed, quotes) {
  const allowed = quotes.some((q) => q.type === 'ejemplo_concreto')
    ? 'evidencia'
    : quotes.some((q) => q.type !== 'indicio')
      ? 'declarada'
      : 'por_validar';
  return RANK[proposed] <= RANK[allowed] ? proposed : allowed;
}

/**
 * @param {object} value      salida ya parseada del modelo
 * @param {string[]} userTexts respuestas de la persona (las mismas que vio el modelo)
 * @param {{ dismissed?: string[] }} profile
 * @returns {{ competencies: object[], missingInformation: string[], rejected: {id?: string, why: string}[] }}
 */
export function validateAnalysis(value, userTexts, profile = {}) {
  const rejected = [];
  const dismissed = new Set(profile.dismissed || []);
  const seen = new Set();
  const quoteUse = new Map();
  const competencies = [];

  for (const item of value.competencies.slice(0, LIMITS.competencies)) {
    const id = item?.id;
    if (!COMPETENCIES[id]) {
      rejected.push({ id, why: 'fuera_del_catalogo' });
      continue;
    }
    if (dismissed.has(id)) {
      rejected.push({ id, why: 'descartada_por_la_persona' });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ id, why: 'repetida' });
      continue;
    }
    if (!STATUSES.includes(item.status)) {
      rejected.push({ id, why: 'estado_invalido' });
      continue;
    }

    const quotes = [];
    for (const ev of (Array.isArray(item.evidence) ? item.evidence : []).slice(0, LIMITS.quotesPerCompetency)) {
      const quote = clean(ev?.quote, LIMITS.quoteChars).replace(/^["“«]+|["”»]+$/g, '');
      let type = QUOTE_TYPES.includes(ev?.type) ? ev.type : 'indicio';
      // Un «ejemplo concreto» que no relata un hecho concreto se registra como afirmación.
      if (type === 'ejemplo_concreto' && !looksLikeEpisode(quote)) {
        rejected.push({ id, why: 'tipo_ajustado_ejemplo_a_afirmacion', quote });
        type = 'afirmacion';
      }
      if (!isLiteralQuote(quote, userTexts)) {
        rejected.push({ id, why: 'cita_no_literal', quote });
        continue;
      }
      if (!beyondOccupation(quote)) {
        rejected.push({ id, why: 'cita_solo_ocupacion', quote });
        continue;
      }
      const key = comparable(quote);
      if ((quoteUse.get(key) || 0) >= LIMITS.competenciesPerQuote) {
        rejected.push({ id, why: 'cita_sobreinterpretada', quote });
        continue;
      }
      if (quotes.some((q) => comparable(q.quote) === key)) continue;
      quotes.push({ quote, type });
    }
    if (!quotes.length) {
      rejected.push({ id, why: 'sin_cita_valida' });
      continue;
    }
    for (const q of quotes) quoteUse.set(comparable(q.quote), (quoteUse.get(comparable(q.quote)) || 0) + 1);

    const status = decideStatus(item.status, quotes);
    if (status !== item.status) rejected.push({ id, why: `estado_ajustado_${item.status}_a_${status}` });

    let level = LEVELS.includes(item.level) ? item.level : null;
    const levelReason = clean(item.level_reason, 200);
    if (level && (status !== 'evidencia' || !levelReason)) {
      rejected.push({ id, why: 'nivel_sin_respaldo' });
      level = null;
    }
    if (item.level && item.level !== NO_LEVEL && !LEVELS.includes(item.level)) rejected.push({ id, why: 'nivel_invalido' });

    seen.add(id);
    competencies.push({
      id,
      name: COMPETENCIES[id].name,
      description: COMPETENCIES[id].description,
      status,
      evidence: quotes,
      level,
      levelReason: level ? levelReason : null,
    });
  }

  const missingInformation = [...new Set(value.missing_information.map((m) => clean(m, 160).replace(/[\s.;,]+$/, '')).filter(Boolean))].slice(0, LIMITS.missing);
  return { competencies, missingInformation, rejected };
}
