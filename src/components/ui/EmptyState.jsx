import { MessagesSquare, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useKallpa } from '../../state/useKallpa.js';

/** Estado vacío cuando aún no hay perfil: invita al diagnóstico o a la demostración. */
export function EmptyProfile({ title = 'Aún no tienes un perfil', text }) {
  const { startDemo } = useKallpa();
  return (
    <section className="empty rise" aria-labelledby="empty-title">
      <span className="empty-icon" aria-hidden="true">
        <MessagesSquare />
      </span>
      <h2 id="empty-title">{title}</h2>
      <p className="muted" style={{ maxWidth: '56ch' }}>
        {text || 'Conversa con Kalna sobre tu experiencia para reconocer tus competencias. También puedes ver el caso de demostración de María (ficticio).'}
      </p>
      <div className="row">
        <Link className="btn btn-primary" to="/diagnostico">
          <MessagesSquare aria-hidden="true" />
          Empezar diagnóstico
        </Link>
        <button type="button" className="btn" onClick={startDemo}>
          <Play aria-hidden="true" />
          Ver demostración
        </button>
      </div>
    </section>
  );
}
