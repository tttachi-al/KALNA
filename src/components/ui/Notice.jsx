import { Info, TriangleAlert } from 'lucide-react';

/** Aviso de datos ficticios / simulados. */
export function FictionNotice({ children }) {
  return (
    <p className="notice notice-fiction" role="note">
      <TriangleAlert aria-hidden="true" />
      <span>
        {children || (
          <>
            <strong>Prototipo con datos de demostración.</strong> Las competencias y ocupaciones son de referencia; las
            historias y personas son ficticias. Nada de lo que ves es una certificación oficial.
          </>
        )}
      </span>
    </p>
  );
}

export function InfoNotice({ children, icon = Info, tone = 'info' }) {
  const Icon = icon;
  return (
    <p className={`notice notice-${tone}`} role="note">
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
