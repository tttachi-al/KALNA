import { AREA_STATUS, AREAS, CATEGORY_AREA, LIMITS, REFERENCE_QUESTIONS } from './guide.js';
import { buildNotesHistory, buildQuestionHistory } from './prompt.js';
import { NOTES_FORMAT, QUESTION_FORMAT } from './schema.js';
import { appendLog, mergeNotes, redact, userTextsOf } from './state.js';
import { parseNotes, parseQuestion, REPEAT_THRESHOLD, reviewQuestion, similarity } from './validate.js';

/**
 * Un turno de la entrevista adaptativa, en dos tareas de QVAC:
 *
 *   1. NOTAS     última respuesta → dijo / evidencias / interpretaciones / falta_saber
 *                (se incorporan solo las partes que pasan la validación)
 *   2. PREGUNTA  diálogo + estado actualizado → siguiente pregunta (o cierre)
 *                → revisión según el taller → un reintento con los motivos
 *                → si vuelve a fallar, pregunta de referencia del taller (`origen: 'guia'`)
 *
 * Los errores de ejecución del modelo (no cargado, tiempo agotado, fallo del
 * worker) NO se capturan aquí: se propagan para que la sesión no cambie y la
 * persona pueda reintentar sin perder la conversación.
 */
export const GENERATION_PARAMS = {
  notes: { temp: 0.2, top_p: 0.9, predict: 700 },
  question: { temp: 0.6, top_p: 0.9, predict: 300 },
};
const MAX_ATTEMPTS = 2;

/**
 * Pregunta de referencia del taller, sin repetir. Orden: el área del tema que
 * acaba de aparecer (si lo hay), luego las áreas pendientes, las parciales y
 * las suficientes.
 */
export function referenceQuestion(state, preferArea = null) {
  const asked = state.preguntas.map((p) => p.texto);
  const fresh = (q) => !asked.some((a) => similarity(a, q.text) >= REPEAT_THRESHOLD);
  const byStatus = AREA_STATUS.flatMap((st) => AREAS.filter((a) => state.areas[a] === st));
  const order = preferArea ? [preferArea, ...byStatus.filter((a) => a !== preferArea)] : byStatus;
  for (const area of order) {
    const q = REFERENCE_QUESTIONS[area].find(fresh);
    if (q) return { area, tipo: q.type, texto: q.text };
  }
  return null;
}

const atLeast = (current, wanted) => (AREA_STATUS.indexOf(wanted) > AREA_STATUS.indexOf(current) ? wanted : current);

/** Llama al modelo hasta MAX_ATTEMPTS veces; `check` devuelve los motivos de rechazo. */
async function attempt(llm, { build, format, params, parse, check }) {
  const tries = [];
  let correction = null;
  let last = null;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const res = await llm.generate({ history: build(correction), responseFormat: format, generationParams: params });
    const parsed = parse(res.text);
    if (!parsed.ok) {
      correction = [parsed.error];
      tries.push({ rechazos: correction });
      continue;
    }
    const { reasons, extra } = check(parsed.value);
    last = { value: parsed.value, extra, model: res.model };
    tries.push({ rechazos: reasons, ...(extra?.log || {}) });
    if (!reasons.length) return { ...last, accepted: true, tries };
    correction = reasons;
  }
  return { ...last, accepted: false, tries };
}

/**
 * @param {object} p
 * @param {object} p.state     estado de la entrevista
 * @param {object} p.profile   perfil de la sesión
 * @param {string|null} p.userText respuesta de la persona; null en el turno de apertura
 * @param {{ generate: Function }} p.llm cliente de generación (QVAC)
 * @param {() => number=} p.now
 * @returns {Promise<{ state: object, close: boolean, question: object|null, origin: 'qvac'|'guia' }>}
 */
export async function runInterviewTurn({ state, profile, userText, llm, now = Date.now }) {
  const opening = userText == null;
  const started = now();
  let s = state;
  let newTopic = null;
  const log = { turno: 0, promptVersion: state.promptVersion };

  // 1. Notas de la última respuesta
  if (!opening) {
    s = { ...s, turns: s.turns + 1, dialog: [...s.dialog, { role: 'user', content: redact(userText) }] };
    const userTexts = userTextsOf(s);
    const base = s;
    const notes = await attempt(llm, {
      build: (correction) => buildNotesHistory({ state: base, profile, correction }),
      format: NOTES_FORMAT,
      params: GENERATION_PARAMS.notes,
      parse: parseNotes,
      // Las notas no se rechazan enteras: cada elemento inválido se descarta al incorporarlas.
      check: (v) => {
        const merged = mergeNotes(base, v, userTexts);
        return { reasons: [], extra: { merged, log: { descartes: merged.rejected } } };
      },
    });
    log.notas = notes.tries;
    if (notes.extra) s = notes.extra.merged.state;

    // ¿La respuesta trajo lo primero sobre un área que seguía sin explorar?
    newTopic = s.dijo.slice(base.dijo.length).map((d) => CATEGORY_AREA[d.categoria]).find((a) => a && base.areas[a] === 'pendiente') || null;

    // El área de la pregunta anterior queda al menos "parcial" si la respuesta aportó algo.
    const prevQuestion = base.preguntas.at(-1);
    if (prevQuestion && s.dijo.length + s.evidencias.length > base.dijo.length + base.evidencias.length) {
      s = { ...s, areas: { ...s.areas, [prevQuestion.area]: atLeast(s.areas[prevQuestion.area], 'parcial') } };
    }
  }

  // 2. Siguiente pregunta
  const userTexts = userTextsOf(s);
  const withNotes = s;
  const q = await attempt(llm, {
    build: (correction) => buildQuestionHistory({ state: withNotes, profile, opening, correction }),
    format: QUESTION_FORMAT,
    params: GENERATION_PARAMS.question,
    parse: parseQuestion,
    // Se registra la propuesta del modelo (también las rechazadas) para auditar la calidad.
    check: (v) => ({
      reasons: reviewQuestion(v, { prev: withNotes, turns: withNotes.turns, evidenceCount: withNotes.evidencias.length, userTexts, opening, newTopic: Boolean(newTopic) }),
      extra: { log: { accion: v.accion, detalle: v.detalle, texto: v.pregunta } },
    }),
  });
  log.pregunta = q.tries;
  log.modelo = q.model || null;

  const atLimit = !opening && s.turns >= LIMITS.maxTurns;
  let close = atLimit || (q.accepted && q.value.accion === 'cerrar');
  const origin = q.accepted ? 'qvac' : 'guia';
  let question = null;
  if (!close) {
    if (q.accepted) {
      question = { area: q.value.area, tipo: q.value.tipo, accion: q.value.accion, detalle: q.value.detalle.trim(), texto: q.value.pregunta.trim() };
    } else {
      const ref = referenceQuestion(s, newTopic);
      if (ref) question = { ...ref, accion: 'preguntar', detalle: '' };
      else close = !opening;
    }
  }

  s = {
    ...s,
    dialog: question ? [...s.dialog, { role: 'assistant', content: question.texto }] : s.dialog,
    preguntas: question ? [...s.preguntas, { turno: s.turns, ...question, origen: origin }] : s.preguntas,
    done: close,
    endedBy: close ? (atLimit ? 'limite' : q.accepted ? 'entrevistador' : 'guia_agotada') : null,
  };
  s = appendLog(s, { ...log, turno: s.turns, origen: origin, ms: now() - started });

  return { state: s, close, question, origin };
}
