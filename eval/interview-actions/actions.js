import { AREA_LABELS, AREAS } from '../../server/interview/guide.js';
import { looksLikeEpisode } from '../../server/interview/state.js';

/**
 * HISTÓRICO — retirado de la aplicación el 2026-10-28 (docs/interview-actions-evaluacion.md).
 * Se conserva como registro de la integración evaluada; el servidor no lo importa.
 *
 * Selección de la SIGUIENTE ACCIÓN de la entrevista con QVAC Decisions (Laya).
 *
 *   reglas (código)  → qué opciones están permitidas en este turno
 *   Decisions        → elige UNA opción permitida a partir de la última respuesta
 *   Qwen (LLM)       → redacta la pregunta para esa acción (turn.js)
 *
 * Decisions no redacta preguntas, no cierra la entrevista, no toca citas ni
 * competencias. Si falla o devuelve algo fuera de las opciones permitidas, el
 * turno sigue con el flujo actual (Qwen elige la acción).
 *
 * Cada opción se traduce a una `accion` del esquema existente (guide.js), así
 * que la validación de preguntas (validate.js) no cambia.
 *
 * Laya recibe `etiqueta` (frases cortas) como opciones de una pregunta
 * `choice`: fue la formulación con más aciertos de las cuatro medidas
 * (docs/interview-actions-evaluacion.md). `criterio` queda como descripción
 * para personas y para las pruebas.
 */
export const DECISION_OPTIONS = {
  pedir_ejemplo: {
    etiqueta: 'respuesta general sin ejemplo',
    accion: 'pedir_ejemplo',
    criterio: 'La respuesta es general o describe una costumbre (lo que suele hacer) y no cuenta una ocasión concreta.',
    guia: 'Pide un ejemplo concreto: una ocasión determinada en la que lo hizo.',
  },
  profundizar_acciones: {
    etiqueta: 'ocasión sin decir qué hizo',
    accion: 'profundizar',
    criterio: 'La respuesta menciona una ocasión concreta, pero no explica qué hizo la persona.',
    guia: 'Pregunta qué hizo la persona, paso a paso, en la ocasión que contó.',
  },
  preguntar_resultado: {
    etiqueta: 'dice qué hizo pero no cómo terminó',
    accion: 'profundizar',
    criterio: 'La respuesta cuenta qué hizo la persona, pero no dice cómo terminó ni qué resultado tuvo.',
    guia: 'Pregunta cómo terminó o qué resultado tuvo lo que hizo.',
  },
  aclarar: {
    etiqueta: 'respuesta confusa o muy corta',
    accion: 'aclarar',
    criterio: 'La respuesta es muy breve, confusa o no se entiende a qué se refiere.',
    guia: 'Pide con neutralidad que aclare lo que quiso decir, sin suponer nada.',
  },
  contrastar: {
    etiqueta: 'contradice lo dicho antes',
    accion: 'contrastar',
    criterio: 'La respuesta contradice algo que la persona dijo antes.',
    guia: 'Menciona con respeto las dos cosas que dijo y pregunta qué diferencia hay entre ellas.',
  },
  explorar_otra_experiencia: {
    etiqueta: 'ocasión completa con resultado',
    accion: 'preguntar',
    criterio: 'La respuesta ya cuenta una ocasión completa, con lo que hizo y cómo terminó: ese tema está claro.',
    guia: 'Pregunta por otra tarea o experiencia distinta de la que ya contó.',
  },
  siguiente_etapa: {
    etiqueta: 'tema ajeno al trabajo',
    accion: 'retomar',
    criterio: 'La respuesta habla de otra cosa que no tiene relación con su trabajo, o el tema actual ya no da para más.',
    guia: 'Pasa a otra etapa pendiente de la entrevista.',
  },
};

export const OPTION_IDS = Object.keys(DECISION_OPTIONS);

/** `preguntar` y `retomar` son equivalentes al comprobar si Qwen siguió la acción. */
const SAME_ACTION = { preguntar: ['preguntar', 'retomar'], retomar: ['preguntar', 'retomar'] };
export const followsAction = (expected, actual) => (SAME_ACTION[expected] || [expected]).includes(actual);

/** Veces que se repite al final la misma acción de pregunta. */
function trailingRepeats(preguntas) {
  const last = preguntas.at(-1)?.accion;
  if (!last) return { accion: null, n: 0 };
  let n = 0;
  for (let i = preguntas.length - 1; i >= 0 && preguntas[i].accion === last; i -= 1) n += 1;
  return { accion: last, n };
}

/** Área a la que se pasa con «siguiente_etapa»: la primera pendiente, si no la primera parcial. */
export function nextArea(state) {
  const current = state.preguntas.at(-1)?.area;
  for (const status of ['pendiente', 'parcial']) {
    const area = AREAS.find((a) => a !== current && state.areas[a] === status);
    if (area) return area;
  }
  return null;
}

/** Máximo de veces seguidas que se permite la misma acción (evita preguntas en bucle). */
export const MAX_SAME_ACTION = 2;

/**
 * Opciones permitidas por las reglas deterministas en este turno.
 * @returns {{ allowed: string[], removed: Record<string, string> }}
 */
export function allowedOptions(state, lastAnswer) {
  const removed = {};
  // Ya relata un hecho puntual: no se pide otro ejemplo de lo mismo (igual que la indicación a Qwen).
  if (looksLikeEpisode(lastAnswer)) removed.pedir_ejemplo = 'ya_relata_un_hecho';
  if (state.dialog.filter((m) => m.role === 'user').length < 2) removed.contrastar = 'sin_respuestas_previas';
  if (!nextArea(state)) removed.siguiente_etapa = 'sin_areas_pendientes';
  const { accion, n } = trailingRepeats(state.preguntas);
  if (n >= MAX_SAME_ACTION) {
    for (const id of OPTION_IDS) if (!removed[id] && followsAction(DECISION_OPTIONS[id].accion, accion)) removed[id] = 'accion_repetida';
  }
  return { allowed: OPTION_IDS.filter((id) => !removed[id]), removed };
}

const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Petición a `decide()`: solo la pregunta anterior, la última respuesta y
 * hasta dos respuestas previas (para detectar contradicciones). Nada más.
 */
export function buildDecisionRequest(state, allowed) {
  const answers = state.dialog.filter((m) => m.role === 'user').map((m) => m.content);
  return {
    state: {
      pregunta_del_entrevistador: clip(state.preguntas.at(-1)?.texto || '', 260),
      respuesta_de_la_persona: clip(answers.at(-1) || '', 600),
      respuestas_anteriores: answers.slice(-3, -1).map((t) => clip(t, 300)),
    },
    questions: {
      siguiente_accion: {
        type: 'choice',
        instructions: '¿Cómo es la respuesta de la persona?',
        criteria: allowed.map((id) => DECISION_OPTIONS[id].etiqueta),
      },
    },
  };
}

/**
 * Lee la respuesta de `decide()`. Una elección fuera de las opciones permitidas
 * se trata como fallo. La confianza se registra, pero NO decide nada: no está
 * calibrada para KALLPA.
 */
export function readDecision(result, allowed) {
  const answer = result?.answers?.siguiente_accion;
  const label = answer?.type === 'choice' ? String(answer.choice) : null;
  const option = allowed.find((id) => DECISION_OPTIONS[id].etiqueta === label);
  if (!option) return { ok: false, error: 'seleccion_invalida', choice: label };
  return { ok: true, option, confidence: answer.answerConfidence ?? null };
}

/**
 * Elige la acción del turno. Nunca lanza: ante cualquier fallo devuelve
 * `option: null` y el turno usa el flujo actual.
 * @returns {Promise<{ option: string|null, log: object }>}
 */
export async function selectAction({ state, lastAnswer, decider, now = Date.now }) {
  const { allowed, removed } = allowedOptions(state, lastAnswer);
  const log = { permitidas: allowed, quitadas: removed, opcion: null, origen: null, ms: 0, confianza: null, error: null };
  if (!allowed.length) return { option: null, log: { ...log, error: 'sin_opciones' } };
  if (allowed.length === 1) return { option: allowed[0], log: { ...log, opcion: allowed[0], origen: 'regla' } };
  const t0 = now();
  try {
    const r = readDecision(await decider.decide(buildDecisionRequest(state, allowed)), allowed);
    log.ms = now() - t0;
    if (!r.ok) return { option: null, log: { ...log, error: r.error } };
    return { option: r.option, log: { ...log, opcion: r.option, origen: 'qvac-decisions', confianza: r.confidence } };
  } catch (error) {
    return { option: null, log: { ...log, ms: now() - t0, error: error?.code || error?.message || String(error) } };
  }
}

/** Indicación para Qwen: la acción ya está elegida; Qwen solo la redacta. */
export function actionInstruction(option, state) {
  const o = DECISION_OPTIONS[option];
  const area = option === 'siguiente_etapa' ? nextArea(state) : null;
  return [
    `Acción elegida por KALLPA para esta pregunta: «${option}». ${o.guia}`,
    `En "accion" pon "${o.accion}"${area ? ` y en "area" pon "${area}" (${AREA_LABELS[area]})` : ''}. Formula la pregunta para esa acción.`,
    'Solo puedes poner "cerrar" en lugar de esa acción si ya corresponde cerrar según las indicaciones de arriba.',
  ].join('\n');
}

/** Motivos de rechazo si Qwen no siguió la acción elegida. */
export function actionReasons(option, value, state) {
  if (!option || value.accion === 'cerrar') return [];
  const reasons = [];
  if (!followsAction(DECISION_OPTIONS[option].accion, value.accion)) reasons.push('accion_distinta_a_la_elegida');
  if (option === 'siguiente_etapa' && value.area !== nextArea(state)) reasons.push('area_distinta_a_la_elegida');
  return reasons;
}
