import { OCC_ICONS } from './icons.js';

/** Ícono de ocupación con su color. Decorativo por defecto (acompaña texto visible). */
export function OccIcon({ id, size = 'md', label }) {
  const Icon = OCC_ICONS[id];
  if (!Icon) return null;
  const cls = size === 'md' ? 'occ-icon' : `occ-icon ${size}`;
  return (
    <span className={`occ ${cls}`} data-tone={id} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Icon strokeWidth={2} />
    </span>
  );
}

/** Píldora compacta con ícono y nombre corto de la ocupación. */
export function OccPill({ id, children }) {
  const Icon = OCC_ICONS[id];
  return (
    <span className="occ occ-pill" data-tone={id}>
      <span className="occ-icon" aria-hidden="true">
        <Icon strokeWidth={2.2} />
      </span>
      {children}
    </span>
  );
}
