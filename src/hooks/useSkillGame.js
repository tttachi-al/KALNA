import { useEffect, useRef, useState } from 'react';
import { diffItems } from '../components/chat/game.js';

const DURATION = { new: 1700, up: 1700, unlock: 2800 };
const MAX_QUEUE = 5;

/**
 * Detecta cambios en las competencias y los convierte en eventos de juego
 * que se muestran uno a uno. Mientras `hold` sea true (mensajes aún
 * apareciendo), los eventos esperan para no adelantarse a la conversación.
 */
export function useSkillGame(items, hold) {
  const prev = useRef(null);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const map = new Map(items.map((i) => [i.id, i.status]));
    const before = prev.current;
    prev.current = map;
    if (!before) return;
    const events = diffItems(before, map);
    if (!events.length) {
      if (map.size < before.size) setQueue([]);
      return;
    }
    // Las de evidencia primero: son las que más celebramos
    events.sort((a, b) => (b.type === 'unlock') - (a.type === 'unlock'));
    setQueue((q) => [...q, ...events].slice(0, MAX_QUEUE));
  }, [items]);

  const current = hold ? null : queue[0] || null;

  useEffect(() => {
    if (!current) return undefined;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), DURATION[current.type]);
    return () => clearTimeout(t);
  }, [current]);

  return current;
}
