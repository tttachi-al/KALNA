import { readFileSync } from 'node:fs';
import { COMPETENCIES } from '../../src/data/competencies.js';
import { normalize } from '../../src/services/engine/text.js';

/**
 * Redacción personalizada de la ruta con el MISMO modelo de generación de la
 * entrevista (QVAC, Qwen). El modelo solo reescribe `objective`, `why` y
 * `action` de actividades ya decididas por las reglas (plan.js); el código
 * valida cada actividad y, si algo no cumple, deja la plantilla.
 *
 * Nunca lanza: si QVAC no responde o la salida no es válida, la ruta queda con
 * las plantillas (`personalization.ok = false` con el motivo).
 */
export const ROUTE_PROMPT_VERSION = 'v2';
const SYSTEM = readFileSync(new URL(`../prompts/route.${ROUTE_PROMPT_VERSION}.md`, import.meta.url), 'utf8');
const FIELDS = ['objective', 'why', 'action'];
const LIMITS = { objective: [10, 180], why: [15, 320], action: [15, 320] };
export const GENERATION_PARAMS = { temp: 0.3, top_p: 0.9, predict: 1800 };

/** Primera persona: la ruta le habla a la persona («tú»), no en su nombre. */
const FIRST_PERSON = /(^|[^\p{L}])(yo|mi|mis|conmigo)(?=[^\p{L}]|$)/iu;
/** Campos que el modelo puede reescribir: en «desarrolla-…» la acción es la práctica del catálogo y no se toca. */
export const fieldsFor = (item) => (item.id.startsWith('desarrolla-') ? ['objective', 'why'] : FIELDS);
/** Palabras que el modelo no puede introducir si no estaban en la plantilla. */
const RISKY = [/https?:\/\/|www\./i, /\bcurso/i, /certific/i, /\bvacante/i, /\boferta/i, /\bempresa/i, /\bgarantiz/i, /\bsueldo|\bsalario/i];
const digits = (s) => new Set(String(s).match(/\d+/g) || []);

export function routeFormat(ids) {
  const str = (min, max) => ({ type: 'string', minLength: min, maxLength: max });
  return {
    type: 'json_schema',
    json_schema: {
      name: 'kallpa_ruta',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['activities'],
        properties: {
          activities: {
            type: 'array',
            minItems: ids.length,
            maxItems: ids.length,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', ...FIELDS],
              properties: { id: { type: 'string', enum: ids }, objective: str(...LIMITS.objective), why: str(...LIMITS.why), action: str(...LIMITS.action) },
            },
          },
        },
      },
    },
  };
}

/** Nombres de competencias que la ruta permite mencionar. */
function allowedNames(route) {
  const ids = new Set(route.classification.map((c) => c.competencyId));
  for (const c of route.classification) if (c.base) ids.add(c.base.id);
  return ids;
}

/**
 * Valida una actividad reescrita frente a su plantilla.
 * @returns {string|null} motivo de rechazo o null si es válida
 */
export function checkActivity(original, rewritten, allowed) {
  for (const f of fieldsFor(original)) {
    const text = String(rewritten?.[f] ?? '').trim();
    const [min, max] = LIMITS[f];
    if (text.length < min || text.length > max) return `${f}_longitud`;
    if (FIRST_PERSON.test(text)) return `${f}_primera_persona`;
    const before = `${original.title} ${original[f]} ${original.list?.join(' ') || ''}`;
    for (const rx of RISKY) if (rx.test(text) && !rx.test(before)) return `${f}_contenido_nuevo`;
    for (const d of digits(text)) if (!digits(before).has(d) && !digits(original.why).has(d)) return `${f}_cifra_nueva`;
    const t = normalize(text);
    for (const [id, c] of Object.entries(COMPETENCIES)) {
      if (!allowed.has(id) && t.includes(normalize(c.name))) return `${f}_competencia_ajena`;
    }
  }
  return null;
}

function contextFor(profile, route) {
  const exp = profile?.experience || {};
  const quotes = [...new Set(Object.values(profile?.competencies || {}).flatMap((c) => [...(c.examples || []).map((e) => e.text), ...(c.mentions || []).map((m) => m.quote)]))]
    .filter(Boolean)
    .slice(0, 6);
  return {
    puesto_destino: route.target.name,
    experiencia: { ocupaciones: exp.occupations || [], formalidad: exp.formality || null, tiempo: exp.duration || null },
    niveles_declarados: Object.values(profile?.competencies || {}).filter((c) => !(profile?.dismissed || []).includes(c.id)).map((c) => ({ id: c.id, estado: c.status, nivel: c.level || null, respaldo: c.levelReason || null })),
    requisitos_del_puesto: route.requirements || [],
    lo_que_conto: quotes,
  };
}

/**
 * @param {{ route: object, profile: object, llm: { generate: Function } | null }} p
 * @returns {Promise<{ route: object, personalization: { ok: boolean, engine: string, accepted?: number, rejected?: object[], reason?: string } }>}
 */
export async function personalizeRoute({ route, profile, llm, strict = false }) {
  if (!llm?.generate) return { route, personalization: { ok: false, engine: 'plantilla', reason: 'sin_modelo' } };
  const items = route.stages.flatMap((s) => s.items);
  const ids = items.map((i) => i.id);
  const history = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `PERSONA: ${JSON.stringify(contextFor(profile, route))}\n\nACTIVIDADES (reescribe objective, why y action de cada una):\n${JSON.stringify(
        items.map(({ id, title, objective, why, action }) => ({ id, title, objective, why, action })),
      )}`,
    },
  ];
  let parsed;
  try {
    const res = await llm.generate({ history, responseFormat: routeFormat(ids), generationParams: GENERATION_PARAMS });
    parsed = JSON.parse(String(res.text).slice(String(res.text).indexOf('{'), String(res.text).lastIndexOf('}') + 1));
  } catch (error) {
    return { route, personalization: { ok: false, engine: 'plantilla', reason: error?.retryable ? 'qvac_no_disponible' : 'json_invalido', detail: error?.message } };
  }
  const allowed = allowedNames(route);
  if (strict && (!Array.isArray(parsed?.activities) || parsed.activities.length !== ids.length ||
      new Set(parsed.activities.map((a) => a?.id)).size !== ids.length ||
      parsed.activities.some((a) => !ids.includes(a?.id)))) {
    return { route, personalization: { ok: false, engine: 'qvac', reason: 'estructura_invalida' } };
  }
  const byId = new Map((Array.isArray(parsed?.activities) ? parsed.activities : []).map((a) => [a?.id, a]));
  const rejected = [];
  let accepted = 0;
  const stages = route.stages.map((s) => ({
    ...s,
    items: s.items.map((item) => {
      const r = byId.get(item.id);
      const why = r ? checkActivity(item, r, allowed) : 'falta';
      if (why) {
        rejected.push({ id: item.id, why });
        return item;
      }
      accepted += 1;
      const next = { ...item, personalized: true };
      for (const f of fieldsFor(item)) next[f] = r[f].trim();
      return next;
    }),
  }));
  return { route: { ...route, stages }, personalization: { ok: accepted > 0, engine: 'qvac', accepted, rejected } };
}
