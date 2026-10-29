// Utilidades compartidas por las pruebas de persistencia.
const AREAS0 = { antes: 'pendiente', hoy: 'pendiente', cambios: 'pendiente', despues: 'pendiente' };

export const notes = () => JSON.stringify({ evidencias: [], dijo: [], interpretaciones: [], falta_saber: [], seguimiento: [], areas: AREAS0 });
export const ques = (pregunta, o = {}) =>
  JSON.stringify({ accion: 'preguntar', area: 'hoy', tipo: 'experiencial', motivo: 'simulado', detalle: '', pregunta, ...o });

/** Modelo simulado: devuelve las salidas en orden. */
export function scriptedLlm(outputs) {
  let i = 0;
  return {
    describe: () => ({ engine: 'simulado', model: 'scripted', status: 'ready' }),
    async generate() {
      const next = outputs[i++];
      if (next === undefined) throw new Error('scriptedLlm: no hay más salidas');
      if (next instanceof Error) throw next;
      return { text: next, model: 'scripted' };
    },
  };
}

/** Respuestas hasta abrir la entrevista adaptativa. */
export const BASICS = [{ choices: ['empezar'] }, { text: 'Luis' }, { choices: ['reponedor'] }, { choices: ['formal'] }, { choices: ['1a3'] }];
