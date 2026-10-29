import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Enlace para volver al paso anterior del recorrido. */
export function BackLink({ to, label }) {
  return (
    <Link to={to} className="btn btn-ghost btn-sm">
      <ArrowLeft aria-hidden="true" />
      Volver a {label}
    </Link>
  );
}
