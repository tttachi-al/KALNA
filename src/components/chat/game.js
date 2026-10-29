import { STATUS } from '../../services/engine/profile.js';

/**
 * Dinámica de juego del diagnóstico. Compara dos estados del panel y
 * devuelve los eventos que se celebran:
 *  - 'new'    → aparece una competencia (declarada o por validar)
 *  - 'up'     → pasa de "por validar" a "declarada"
 *  - 'unlock' → queda respaldada con evidencia
 * Si algo desaparece o baja (reinicio, cambio de paso en la demostración), no hay eventos.
 */
export function diffItems(prev, next) {
  for (const [id, status] of prev) {
    if (!next.has(id) || STATUS[next.get(id)].rank < STATUS[status].rank) return [];
  }
  const events = [];
  for (const [id, status] of next) {
    const before = prev.get(id);
    if (before === status) continue;
    const type = status === 'evidencia' ? 'unlock' : before ? 'up' : 'new';
    events.push({ id, status, type });
  }
  return events;
}
