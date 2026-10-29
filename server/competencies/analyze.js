import { readFileSync } from 'node:fs';
import { COMPETENCIES, FAMILIES } from '../../src/data/competencies.js';
import { OCCUPATIONS } from '../../src/data/occupations.js';
import { DURATION_LABELS, FORMALITY_DISPLAY } from '../../src/services/engine/diagnosisFlow.js';
import { userTextsOf } from '../interview/state.js';
import { ANALYSIS_FORMAT, PROMPT_VERSION } from './schema.js';
import { parseAnalysis, validateAnalysis } from './validate.js';

/**
 * Identificación de competencias con QVAC (una sola vez por diagnóstico, al
 * cerrar la entrevista). Es una tarea aparte de la conversación: usa el mismo
 * cliente de generación, pero su propio prompt, su esquema y su validación.
 *
 * Entrada: el diálogo de la entrevista que guarda la sesión (ya sin correos
 * ni números largos, ver `redact()`), más los datos básicos del perfil.
 * Nada de esto se guarda en la base de datos.
 *
 * Nunca lanza: si QVAC falla o la salida no valida tras un reintento,
 * devuelve `{ ok: false, reason }` y el flujo sigue con el motor de reglas.
 */
export const GENERATION_PARAMS = { temp: 0.1, top_p: 0.9, predict: 1200 };
const MAX_ATTEMPTS = 2;

const catalogText = () =>
  Object.values(COMPETENCIES)
    .map((c) => `- ${c.id}: ${c.name} (${FAMILIES[c.family].name}) — ${c.description}`)
    .join('\n');

export const ANALYSIS_PROMPT = readFileSync(new URL(`../prompts/competencies.${PROMPT_VERSION}.md`, import.meta.url), 'utf8').replace('{{CATALOGO}}', catalogText());

function context(profile) {
  const exp = profile?.experience || {};
  return {
    ocupaciones_elegidas: (exp.occupations || []).map((id) => OCCUPATIONS[id]?.name).filter(Boolean),
    tipo_de_experiencia: exp.formality ? FORMALITY_DISPLAY[exp.formality] : null,
    tiempo_de_experiencia: exp.duration ? DURATION_LABELS[exp.duration] : null,
  };
}

/** `history` para `completion()`: instrucciones, transcripción y tarea. */
export function buildAnalysisHistory({ interview, profile, correction = null, hints = [] }) {
  const transcript = interview.dialog.map((m) => `${m.role === 'user' ? 'Persona' : 'Entrevistador'}: ${m.content}`).join('\n');
  const task = [
    `Datos que la persona eligió antes de la entrevista (contexto, no son evidencia): ${JSON.stringify(context(profile))}`,
    `ENTREVISTA:\n"""\n${transcript}\n"""`,
    'Devuelve el JSON con las competencias del catálogo que muestran las respuestas de la persona.',
  ];
  if (hints.length) {
    // Pistas de la búsqueda semántica (embeddings): orientan, no prueban nada.
    const lines = hints.map((h) => `- «${h.quote}» → ${h.candidates.map((c) => c.id).join(', ')}`).join('\n');
    task.splice(2, 0, `PISTAS (búsqueda por significado; pueden equivocarse, úsalas solo si la cita realmente lo muestra):\n${lines}`);
  }
  if (correction) task.push(`Tu respuesta anterior no se pudo usar (${correction}). Devuelve solo el objeto JSON completo y válido.`);
  return [
    { role: 'system', content: ANALYSIS_PROMPT },
    { role: 'user', content: task.join('\n\n') },
  ];
}

/**
 * @param {{ interview: object, profile: object, llm: { generate: Function }, now?: () => number }} p
 * @returns {Promise<{ ok: true, competencies: object[], missingInformation: string[], rejected: object[], model: string|null, tries: object[], ms: number }
 *                  | { ok: false, reason: string, tries: object[], ms: number }>}
 */
export async function runCompetencyAnalysis({ interview, profile, llm, hints = [], now = Date.now }) {
  const started = now();
  const userTexts = userTextsOf(interview);
  const tries = [];
  if (!userTexts.length) return { ok: false, reason: 'sin_respuestas', tries, ms: 0 };

  let correction = null;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    let res;
    try {
      res = await llm.generate({ history: buildAnalysisHistory({ interview, profile, correction, hints }), responseFormat: ANALYSIS_FORMAT, generationParams: GENERATION_PARAMS });
    } catch (error) {
      // Error de ejecución (modelo no cargado, tiempo agotado…): no se reintenta aquí.
      tries.push({ error: error?.message || String(error) });
      return { ok: false, reason: 'qvac_no_disponible', detail: error?.message || String(error), tries, ms: now() - started };
    }
    const parsed = parseAnalysis(res.text);
    if (!parsed.ok) {
      tries.push({ rechazo: parsed.error });
      correction = parsed.error;
      continue;
    }
    const v = validateAnalysis(parsed.value, userTexts, profile);
    tries.push({ propuestas: parsed.value.competencies.length, aceptadas: v.competencies.length, descartes: v.rejected });
    return { ok: true, ...v, model: res.model || null, tries, ms: now() - started };
  }
  return { ok: false, reason: 'json_invalido', tries, ms: now() - started };
}
