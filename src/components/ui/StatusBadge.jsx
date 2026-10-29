import { STATUS } from '../../services/engine/profile.js';
import { STATUS_ICONS } from './icons.js';

export function StatusBadge({ status }) {
  const Icon = STATUS_ICONS[status];
  const meta = STATUS[status];
  if (!meta) return null;
  return (
    <span className={`badge badge-${status}`}>
      <Icon aria-hidden="true" strokeWidth={2.4} />
      {meta.label}
    </span>
  );
}
