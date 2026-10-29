import { readFileSync } from 'node:fs';
import { DURATION_LABELS, FORMALITY_DISPLAY } from '../../src/services/engine/diagnosisFlow.js';
import { OCCUPATIONS } from '../../src/data/occupations.js';
import { AREA_LABELS, AREAS, LIMITS } from './guide.js';
import { looksLikeEpisode, PROMPT_VERSION } from './state.js';

/**
 * Construye el `history` que recibe `completion()` de QVAC, con tres partes
 * separadas:
 *   1. instrucciones del sistema (plantillas versionadas en server/prompts/)
 *   2. el diálogo de la entrevista (persona ↔ entrevistador), solo texto natural
 *   3. el estado estructurado de la entrevista y la tarea de este turno
 *      (mensaje de sistema al final, generado por KALLPA, no por la persona)
 *
 * Cada turno usa dos tareas: "notas" (registrar la última respuesta) y
 * "pregunta" (decidir y redactar la siguiente pregunta).
 */
const load = (name) => readFileSync(new URL(`../prompts/${name}.${PROMPT_VERSION}.md`, import.meta.url), 'utf8');

export const SYSTEM_PROMPT = load('interview');
export const NOTES_TASK = load('notes');
export const QUESTION_TASK = load('question');

function knownContext(profile) {
  const exp = profile?.experience || {};
  const occs = (exp.occupations || []).map((id) => OCCUPATIONS[id]?.name).filter(Boolean);
  return {
    ocupaciones_elegidas: occs,
    tipo_de_experiencia: exp.formality ? FORMALITY_DISPLAY[exp.formality] : null,
    tiempo_de_experiencia: exp.duration ? DURATION_LABELS[exp.duration] : null,
  };
}

/** Vista del estado que se envía al modelo (sin registro interno ni diálogo duplicado). */
export function stateView(state, profile) {
  return {
    datos_ya_respondidos: knownContext(profile),
    respuestas_de_la_persona: state.turns,
    areas: Object.fromEntries(AREAS.map((a) => [a, { nombre: AREA_LABELS[a], estado: state.areas[a] }])),
    dijo: state.dijo.map(({ categoria, cita }) => ({ categoria, cita })),
    evidencias: state.evidencias.map(({ cita, accion, resultado }) => ({ cita, accion, resultado })),
    interpretaciones_hipotesis: state.interpretaciones.map(({ tipo, texto, respaldo }) => ({ tipo, texto, respaldo })),
    falta_saber: state.falta_saber,
    seguimiento_pendiente: state.seguimiento,
    preguntas_ya_hechas: state.preguntas.map((p) => p.texto),
  };
}

/** Explicación en palabras de los motivos de rechazo más frecuentes. */
const REASON_HINTS = {
  cierre_con_tema_nuevo: 'la última respuesta abrió un tema nuevo: no cierres, pregunta sobre ese tema',
  cierre_prematuro: 'todavía es pronto para cerrar',
  cierre_sin_evidencia: 'aún no hay ningún ejemplo concreto: pide uno',
  mas_de_una_pregunta: 'haz una sola pregunta',
  pregunta_repetida: 'esa pregunta ya se hizo',
  copia_la_respuesta: 'no repitas la respuesta de la persona',
  detalle_sin_respaldo: '"detalle" debe salir de las palabras de la persona',
  seguimiento_sin_detalle: 'indica en "detalle" qué palabras de la persona sigues',
};
const explain = (reasons) => reasons.map((r) => (REASON_HINTS[r] ? `${r} (${REASON_HINTS[r]})` : r)).join(', ');

function contextBlock(state, profile, lines, correction) {
  const out = [
    'ESTADO DE LA ENTREVISTA (lo mantiene KALLPA; las interpretaciones son hipótesis, no hechos):',
    JSON.stringify(stateView(state, profile), null, 1),
    '',
    ...lines,
  ];
  if (correction) out.push('', `Tu respuesta anterior NO se pudo usar por: ${explain(correction)}. Genera otra que cumpla todas las reglas.`);
  return out.join('\n');
}

const dialogOf = (state, size) => state.dialog.slice(-size).map(({ role, content }) => ({ role, content }));

/** Tarea "notas": solo necesita la última pregunta y la última respuesta. */
export function buildNotesHistory({ state, profile, correction = null }) {
  const lastAnswer = state.dialog.at(-1)?.content || '';
  const task = [NOTES_TASK, '', `Última respuesta de la persona: "${lastAnswer}"`];
  if (looksLikeEpisode(lastAnswer)) task.push('Indicio de KALLPA: la última respuesta parece relatar un hecho concreto. Si es así, regístralo en "evidencias" con su cita literal.');
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...dialogOf(state, 2), { role: 'system', content: contextBlock(state, profile, task, correction) }];
}

/** Tarea "pregunta": recibe el diálogo reciente y el estado ya actualizado con las notas. */
export function buildQuestionHistory({ state, profile, opening = false, correction = null }) {
  const task = [QUESTION_TASK, ''];
  if (opening) {
    task.push(
      'Es el PRIMER turno: la persona solo respondió los datos de arriba. Formula una primera pregunta abierta y experiencial, sin volver a preguntar esos datos. "detalle" va vacío.',
    );
  } else {
    const lastAnswer = state.dialog.at(-1)?.content || '';
    task.push(`Última respuesta de la persona: "${lastAnswer}"`);
    if (looksLikeEpisode(lastAnswer)) {
      task.push('Indicio de KALLPA: la última respuesta ya relata un hecho concreto. No pidas otro ejemplo de lo mismo: profundiza en ese hecho (por qué, quién, qué resultado tuvo) o pasa a un área pendiente.');
    }
    task.push(state.turns >= LIMITS.minTurnsToClose ? 'Ya puedes cerrar si entiendes lo esencial y hay al menos un ejemplo concreto en evidencias.' : 'Todavía no cierres la entrevista.');
    if (state.turns >= LIMITS.maxTurns - 2) task.push('Quedan muy pocos turnos: prioriza lo más importante que falta o cierra.');
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...dialogOf(state, LIMITS.historyWindow),
    { role: 'system', content: contextBlock(state, profile, task, correction) },
  ];
}
