import { useRef } from 'react';
import { JobRecommendations } from '../components/map/JobRecommendations.jsx';
import { BackLink } from '../components/ui/BackLink.jsx';
import { EmptyProfile } from '../components/ui/EmptyState.jsx';
import { FictionNotice, InfoNotice } from '../components/ui/Notice.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDemoAnchor } from '../hooks/useDemoAnchor.js';
import { hasProfile } from '../services/engine/profile.js';
import { kallpaService } from '../services/kallpaService.js';
import { useKallpa } from '../state/useKallpa.js';
import './occupations.css';

/** Cantidad de puestos que se recomiendan en esta pantalla. */
const JOB_LIMIT = 6;

export default function OccupationsPage() {
  const { profile } = useKallpa();
  const jobsRef = useRef(null);
  useDemoAnchor({ puestos: jobsRef });
  const ok = hasProfile(profile);
  const { data: jobs, error } = useAsync(
    () => (ok ? kallpaService.recommendJobs(profile, JOB_LIMIT) : []),
    [profile, ok],
  );

  return (
    <div className="page occupations">
      <BackLink to="/perfil" label="Mi perfil" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Paso 3 · Puestos</p>
          <h1>Puestos recomendados para postular</h1>
          {ok && (
            <p className="muted">
              {kallpaService.mode === 'qvac'
                ? 'Avisos simulados de Empleos Perú, elegidos por el servidor de Kalna según tus competencias. Puedes postular para practicar; las ofertas vigentes están en Empleos Perú.'
                : 'Modo demostración: puestos de ejemplo calculados en este navegador. Las ofertas vigentes se publican en Empleos Perú.'}
            </p>
          )}
        </div>
      </header>

      {ok ? (
        <section aria-label="Puestos recomendados" ref={jobsRef} data-demo-anchor>
          {error ? (
            <InfoNotice tone="fiction">
              No se pudieron cargar las recomendaciones: {error.message} Vuelve a intentarlo en unos
              segundos.
            </InfoNotice>
          ) : (
            <JobRecommendations jobs={jobs} placeholders={JOB_LIMIT} />
          )}
        </section>
      ) : (
        <EmptyProfile text="Para recomendarte puestos según tu experiencia, primero conversa con Kalna o mira el caso de demostración." />
      )}

      {ok && (
        <FictionNotice>
          Recomendaciones orientativas con competencias de referencia. No predicen contratación; las
          vacantes y sus requisitos se revisan en Empleos Perú.
        </FictionNotice>
      )}
    </div>
  );
}
