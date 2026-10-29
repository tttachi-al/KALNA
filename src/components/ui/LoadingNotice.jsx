import { LoaderCircle } from 'lucide-react';

/** Aviso de carga para procesos que tardan (recomendaciones, rutas generadas con IA). */
export function LoadingNotice({ title, children }) {
  return (
    <div className="loading-notice" role="status" aria-live="polite">
      <LoaderCircle className="loading-spin" aria-hidden="true" />
      <div>
        <p className="loading-title">{title}</p>
        {children && <p className="muted text-sm">{children}</p>}
      </div>
    </div>
  );
}
