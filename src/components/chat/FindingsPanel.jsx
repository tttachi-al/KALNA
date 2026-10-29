import { Sparkles } from 'lucide-react';
import { COMPETENCIES, FAMILIES, FAMILY_ORDER } from '../../data/competencies.js';
import { SkillPips } from './GameBits.jsx';

/**
 * Panel "Lo que voy reconociendo": muestra en vivo las competencias
 * potenciales detectadas durante la conversación, agrupadas por familia,
 * con el avance de cada una.
 * @param {{items: {id: string, status: string}[], highlight?: string|null}} props
 */
export function FindingsPanel({ items, compact = false, highlight = null }) {
  const byFamily = FAMILY_ORDER.map((f) => ({
    family: FAMILIES[f],
    items: items.filter((i) => COMPETENCIES[i.id]?.family === f),
  })).filter((g) => g.items.length);

  return (
    <div className={`findings ${compact ? 'is-compact' : ''}`}>
      {!compact && (
        <div className="findings-head">
          <Sparkles aria-hidden="true" />
          <h2>Lo que voy reconociendo</h2>
          <span
            key={items.length}
            className="badge badge-neutral findings-count"
            aria-label={`${items.length} competencias`}
          >
            {items.length}
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <p className="muted text-sm">Aún no hay competencias.</p>
      ) : (
        <>
          <div className="findings-groups" aria-live="polite">
            {byFamily.map((g) => (
              <section key={g.family.id} aria-label={g.family.name}>
                <h3 className="findings-family">{g.family.name}</h3>
                <ul role="list">
                  {g.items.map((i) => (
                    <li
                      key={i.id}
                      className={`findings-item is-${i.status} ${highlight === i.id ? 'is-fresh' : ''}`}
                    >
                      <span>{COMPETENCIES[i.id].name}</span>
                      <SkillPips status={i.status} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="findings-note">Son competencias potenciales. Ninguna está certificada.</p>
        </>
      )}
    </div>
  );
}
