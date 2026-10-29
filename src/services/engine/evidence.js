import { normalize } from './text.js';

/**
 * Evalúa si un ejemplo es lo bastante CONCRETO para respaldar una competencia.
 *
 * Regla de demostración (no es IA):
 *  - "fuerte":       ≥ 50 caracteres y al menos un detalle concreto
 *                    (frecuencia, secuencia, cantidad, motivo o resultado)
 *  - "parcial":      ≥ 20 caracteres, pero sin detalles concretos
 *  - "insuficiente": respuesta muy corta
 *
 * Un ejemplo "fuerte" cambia el estado a "Con evidencia". Nunca certifica.
 */
const CONCRETE_MARKERS = [
  /\b(cada|siempre|todos los dias|diario|diariamente|semana\w*|mes\w*|lunes|martes|miercoles|jueves|viernes|sabado\w*|domingo\w*|turno\w*|manana\w*|tarde\w*|noche\w*)\b/,
  /\b(primero|luego|despues|al final|antes de|mientras)\b/,
  /\b(una vez|un dia|cuando|si)\b/,
  /\b(porque|para que|para no|asi|por eso|de esa forma)\b/,
  /\d/,
  /\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|cien)\b/,
];

export function evaluateEvidence(text = '') {
  const t = String(text).trim();
  const n = normalize(t);
  const markers = CONCRETE_MARKERS.filter((rx) => rx.test(n)).length;

  if (t.length >= 50 && markers >= 1) {
    return { level: 'fuerte', markers };
  }
  if (t.length >= 20) {
    return { level: 'parcial', markers };
  }
  return { level: 'insuficiente', markers };
}

export const EVIDENCE_TIPS = [
  'Qué hiciste exactamente',
  'Cada cuánto o en qué momento',
  'Qué resultado tuvo o por qué lo hacías así',
];
