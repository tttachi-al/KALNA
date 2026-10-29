import { normalize } from '../../src/services/engine/text.js';
import { AREA_STATUS, AREAS, INTERPRETATION_TYPES, SAID_CATEGORIES } from './guide.js';

/**
 * Estado estructurado de la entrevista (vive en `session.interview`).
 *
 * Separa de forma explícita:
 *   - dijo:             lo que la persona dijo (cita literal)
 *   - evidencias:       relatos concretos de algo que hizo (cita literal)
 *   - interpretaciones: hipótesis del modelo, siempre con su cita de base;
 *                       nunca son hechos ni competencias demostradas
 *   - falta_saber:      lo que todavía no se sabe
 * y lleva el control de preguntas formuladas, áreas y seguimiento.
 */
export const PROMPT_VERSION = 'v2';

const MAX = { dijo: 40, evidencias: 12, interpretaciones: 20, log: 40 };

export function createInterviewState() {
  return {
    version: 1,
    promptVersion: PROMPT_VERSION,
    turns: 0,
    dialog: [],
    areas: Object.fromEntries(AREAS.map((a) => [a, 'pendiente'])),
    dijo: [],
    evidencias: [],
    interpretaciones: [],
    falta_saber: [],
    seguimiento: [],
    preguntas: [],
    done: false,
    endedBy: null,
    log: [],
  };
}

/**
 * Quita datos que KALLPA no necesita (correos y números largos como DNI o
 * teléfono) antes de enviarlos al modelo o guardarlos en el estado.
 */
export function redact(text = '') {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[dato omitido]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[dato omitido]');
}

/** Normaliza para comparar citas: sin tildes, sin signos, espacios colapsados. */
export function comparable(text = '') {
  return normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿La cita aparece literalmente en alguna respuesta de la persona? */
export function isLiteralQuote(quote, userTexts) {
  const q = comparable(quote);
  if (q.length < 3) return false;
  return userTexts.some((t) => comparable(t).includes(q));
}

const rank = (status) => AREA_STATUS.indexOf(status);
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Incorpora las notas de un turno YA PARSEADO al estado.
 * Todo lo que no cumple las reglas se descarta y se informa en `rejected`.
 *
 * @param {object} state      estado actual (no se modifica)
 * @param {object} notes      salida del modelo (campos dijo, evidencias, …)
 * @param {string[]} userTexts respuestas de la persona en la entrevista (ya redactadas)
 * @returns {{ state: object, rejected: {field: string, why: string}[] }}
 */
export function mergeNotes(state, notes, userTexts) {
  const rejected = [];
  const turno = state.turns;
  const next = { ...state };

  const quoteOk = (field, quote) => {
    if (!isLiteralQuote(quote, userTexts)) {
      rejected.push({ field, why: 'cita_no_literal' });
      return false;
    }
    return true;
  };

  // 1. Lo que dijo
  const dijo = [...state.dijo];
  for (const d of notes.dijo || []) {
    const cita = clean(redact(d.cita), 200);
    if (!SAID_CATEGORIES.includes(d.categoria)) {
      rejected.push({ field: 'dijo', why: 'categoria_invalida' });
      continue;
    }
    if (!quoteOk('dijo', cita)) continue;
    if (dijo.some((x) => comparable(x.cita) === comparable(cita))) continue;
    dijo.push({ categoria: d.categoria, cita, turno });
  }

  // 2. Evidencias: relato concreto, con cita literal y una acción descrita
  const evidencias = [...state.evidencias];
  for (const e of notes.evidencias || []) {
    const cita = clean(redact(e.cita), 200);
    const accion = clean(e.accion, 160);
    if (!quoteOk('evidencias', cita)) continue;
    if (!accion) {
      rejected.push({ field: 'evidencias', why: 'sin_accion' });
      continue;
    }
    if (evidencias.some((x) => comparable(x.cita) === comparable(cita))) continue;
    // Una descripción habitual ("acomodo la mercadería") no es un hecho concreto:
    // se conserva como algo que dijo, no como evidencia.
    const source = userTexts.find((t) => comparable(t).includes(comparable(cita)));
    if (!looksLikeEpisode(source)) {
      rejected.push({ field: 'evidencias', why: 'sin_relato_concreto' });
      if (!dijo.some((x) => comparable(x.cita) === comparable(cita))) dijo.push({ categoria: 'tareas', cita, turno });
      continue;
    }
    evidencias.push({ cita, accion, resultado: clean(e.resultado, 160), turno });
  }
  next.evidencias = evidencias.slice(-MAX.evidencias);
  next.dijo = dijo.slice(-MAX.dijo);

  // 3. Interpretaciones: hipótesis con cita de base. El respaldo lo calcula el código.
  const interpretaciones = [...state.interpretaciones];
  for (const i of notes.interpretaciones || []) {
    const cita_base = clean(redact(i.cita_base), 200);
    const texto = clean(i.texto, 180);
    if (!INTERPRETATION_TYPES.includes(i.tipo) || !texto) {
      rejected.push({ field: 'interpretaciones', why: 'tipo_o_texto_invalido' });
      continue;
    }
    if (!quoteOk('interpretaciones', cita_base)) continue;
    const backed = evidencias.some((e) => {
      const a = comparable(e.cita);
      const b = comparable(cita_base);
      return a.includes(b) || b.includes(a);
    });
    // Una competencia sin relato concreto que la respalde no se registra como tal.
    let tipo = i.tipo;
    if (tipo === 'competencia_potencial' && !backed) {
      rejected.push({ field: 'interpretaciones', why: 'competencia_sin_evidencia' });
      tipo = 'habilidad';
    }
    if (interpretaciones.some((x) => x.tipo === tipo && comparable(x.texto) === comparable(texto))) continue;
    interpretaciones.push({ tipo, texto, cita_base, turno, estado: 'hipotesis', respaldo: backed ? 'relato_concreto' : 'solo_mencion' });
  }
  next.interpretaciones = interpretaciones.slice(-MAX.interpretaciones);

  // 4. Lo que falta saber y lo que requiere seguimiento: la visión actual del modelo
  next.falta_saber = (notes.falta_saber || []).map((s) => clean(s, 140)).filter(Boolean).slice(0, 5);
  next.seguimiento = (notes.seguimiento || []).map((s) => clean(s, 140)).filter(Boolean).slice(0, 3);

  // 5. Áreas: nunca retroceden
  const areas = { ...state.areas };
  for (const a of AREAS) {
    const incoming = notes.areas?.[a];
    if (AREA_STATUS.includes(incoming) && rank(incoming) > rank(areas[a])) areas[a] = incoming;
  }
  next.areas = areas;

  return { state: next, rejected };
}

/**
 * Indicio (no conclusión) de que un texto relata un hecho concreto: marcas de
 * un episodio ("una vez", "ayer", "la semana pasada"…). Se pasa al modelo como
 * pista; la evidencia solo se registra si el modelo la cita literalmente.
 */
const EPISODE = /\b(una vez|esa vez|ayer|anoche|hoy|el otro dia|la semana pasada|el mes pasado|el ano pasado|hace (un|una|dos|tres|unos|unas|\d+)|un (dia|lunes|martes|miercoles|jueves|viernes|sabado|domingo)|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)|cuando (llego|paso|se|me|nos|vino))\b/;

export function looksLikeEpisode(text = '') {
  return EPISODE.test(comparable(text));
}

/** Respuestas de la persona dentro de la entrevista. */
export function userTextsOf(state) {
  return state.dialog.filter((m) => m.role === 'user').map((m) => m.content);
}

export function appendLog(state, entry) {
  return { ...state, log: [...state.log, entry].slice(-MAX.log) };
}
