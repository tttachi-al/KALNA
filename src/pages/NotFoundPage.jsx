import { House } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page">
      <section className="empty">
        <h1>No encontramos esta página</h1>
        <p className="muted">Puede que el enlace haya cambiado. Vuelve al inicio para continuar.</p>
        <Link to="/" className="btn btn-primary">
          <House aria-hidden="true" />
          Ir al inicio
        </Link>
      </section>
    </div>
  );
}
