import { BadgeCheck } from 'lucide-react';
import { COMPETENCIES } from '../../data/competencies.js';
import { STATUS } from '../../services/engine/profile.js';
import { STATUS_ICONS } from '../ui/icons.js';

/** Tres segmentos: pista → declarada → con evidencia. */
export function SkillPips({ status }) {
  const rank = STATUS[status]?.rank || 0;
  return (
    <span className={`pips pips-${status}`} title={STATUS[status]?.label}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= rank ? 'is-on' : ''} />
      ))}
      <span className="sr-only">
        {STATUS[status]?.label} ({rank} de 3)
      </span>
    </span>
  );
}

const POP_COPY = {
  new: 'Competencia identificada',
  up: 'Competencia confirmada',
  unlock: 'Respaldada con evidencia',
};

/** Aviso breve sobre el chat cuando una competencia aparece o cambia de estado. */
export function SkillPop({ event }) {
  if (!event) return null;
  const Icon = STATUS_ICONS[event.status] || BadgeCheck;
  const name = COMPETENCIES[event.id]?.name;
  return (
    <div className={`skill-pop is-${event.status}`} role="status">
      <span className="skill-pop-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="skill-pop-text">
        <span className="skill-pop-label">{POP_COPY[event.type]}</span>
        <strong>{name}</strong>
      </span>
    </div>
  );
}
