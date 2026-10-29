import {
  Building2,
  CircleCheck,
  Send,
  ExternalLink,
  IdCard,
  MapPin,
  Route,
  Target,
  Waypoints,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { kallpaService } from '../../services/kallpaService.js';
import { COMPETENCIES } from '../../data/competencies.js';
import { RESOURCES } from '../../data/resources.js';
import { targetFromRecommendation } from '../../services/engine/targets.js';
import { useKallpa } from '../../state/useKallpa.js';
import { LoadingNotice } from '../ui/LoadingNotice.jsx';
import { SegBar } from './MatchParts.jsx';

/** Afinidad del puesto con el perfil (misma escala que la cercanía de ocupaciones). */
const FIT_LABELS = { 'muy-cercana': 'Muy afín', cercana: 'Afín', 'por-explorar': 'Por explorar' };

const names = (items) => items.map((i) => COMPETENCIES[i.id]?.name).filter(Boolean);

/**
 * Acciones del puesto: la ruta y el pasaporte se crean para ESTE puesto cuando la
 * persona decide (no se generan automáticamente para cada recomendación).
 */
function JobActions({ job, onPlan }) {
  return (
    <div className="job-actions">
      <button type="button" className="btn btn-sm" onClick={() => onPlan(job, '/ruta')}>
        <Route aria-hidden="true" />
        Crear mi ruta
        <span className="sr-only"> hacia {job.name}</span>
      </button>
      <button type="button" className="btn btn-sm" onClick={() => onPlan(job, '/pasaporte')}>
        <IdCard aria-hidden="true" />
        Pasaporte para este puesto
        <span className="sr-only"> ({job.name})</span>
      </button>
    </div>
  );
}

function JobCard({ job, isTarget, onPlan }) {
  const has = names(job.matches);
  const base = names(job.transferable);
  return (
    <article className={`job-card ${isTarget ? 'is-target' : ''}`}>
      <header className="job-head">
        <p className="job-area">{job.area}</p>
        {isTarget ? (
          <span className="badge badge-brand">
            <Target aria-hidden="true" />
            Tu objetivo
          </span>
        ) : (
          <span className={`occ-card-close is-${job.closeness}`}>{FIT_LABELS[job.closeness]}</span>
        )}
      </header>
      <h3 className="job-name">{job.name}</h3>
      {(job.company || job.location) && (
        <p className="job-meta">
          {job.company && (
            <span>
              <Building2 aria-hidden="true" />
              {job.company}
            </span>
          )}
          {job.location && (
            <span>
              <MapPin aria-hidden="true" />
              {job.location}
            </span>
          )}
        </p>
      )}
      <p className="muted text-sm">{job.summary}</p>
      <SegBar cmp={job} />
      <dl className="job-fit">
        {has.length > 0 && (
          <div className="is-match">
            <dt>
              <CircleCheck aria-hidden="true" />
              Ya tienes
            </dt>
            <dd>{has.join(' · ')}</dd>
          </div>
        )}
        {base.length > 0 && (
          <div className="is-transfer">
            <dt>
              <Waypoints aria-hidden="true" />
              Puedes aprovechar
            </dt>
            <dd>{base.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {job.synthetic ? (
        <div className="job-cta">
          {job.pendingRequirements?.length > 0 && (
            <div className="text-sm">
              <p className="msg-label">Requisitos por verificar</p>
              <ul>
                {job.pendingRequirements.map((r) => (
                  <li key={r.text}>{r.text}</li>
                ))}
              </ul>
            </div>
          )}
          <a
            className="btn btn-primary btn-block"
            href={RESOURCES.empleos.portal}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send aria-hidden="true" />
            Postular
            <span className="sr-only">
              {' '}
              en {RESOURCES.empleos.name} (se abre en una nueva pestaña)
            </span>
          </a>
          <p className="muted text-sm">
            Puesto de referencia: en {RESOURCES.empleos.name} busca ofertas vigentes parecidas a «
            {job.name}».
          </p>
          <JobActions job={job} onPlan={onPlan} />
        </div>
      ) : (
        <div className="job-cta">
          <a
            className="btn btn-primary btn-block"
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Postular en {RESOURCES.empleos.name}
            <ExternalLink aria-hidden="true" />
            <span className="sr-only"> (se abre en una nueva pestaña)</span>
          </a>
          <p className="job-search">
            Busca «<strong>{job.search}</strong>»
          </p>
          <JobActions job={job} onPlan={onPlan} />
        </div>
      )}
    </article>
  );
}

/**
 * Puestos recomendados para postular según el perfil (pueden estar fuera de las
 * cinco ocupaciones). Cada uno enlaza a Empleos Perú y permite crear una ruta y un
 * pasaporte (resumen para el CV) dirigidos a ese puesto.
 */
export function JobRecommendations({ jobs, placeholders = 3 }) {
  const { profile, dispatch, isDemo } = useKallpa();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const plan = async (job, to) => {
    if (busy) return;
    if (to === '/pasaporte') {
      setBusy(true);
      setError(null);
      try {
        const simulation = isDemo || kallpaService.mode === 'mock';
        const passport = simulation
          ? kallpaService.createDemoPassport(profile, job.jobId, targetFromRecommendation(job))
          : await kallpaService.createPassport(profile?.profileId, job.jobId);
        if (simulation) dispatch({ type: 'passport/store', passport });
        dispatch({ type: 'profile/target', occupationId: job.jobId, job: job.synthetic ? targetFromRecommendation(job) : null });
        navigate('/pasaporte?puesto=' + encodeURIComponent(job.jobId), { state: simulation ? null : { passport } });
      } catch (e) { setError(e.message); }
      finally { setBusy(false); }
      return;
    }
    dispatch({
      type: 'profile/target',
      occupationId: job.jobId,
      // Los empleos del servidor no están en los catálogos locales: se guarda su copia.
      job: job.synthetic ? targetFromRecommendation(job) : null,
    });
    navigate(to);
  };

  if (!jobs) {
    return (
      <>
        <LoadingNotice title="Buscando los puestos que mejor encajan contigo…">
          Comparamos tus competencias y ejemplos con cada puesto. Puede tardar unos segundos.
        </LoadingNotice>
        <div className="job-grid" aria-hidden="true">
          {Array.from({ length: placeholders }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 340 }} />
          ))}
        </div>
      </>
    );
  }
  if (!jobs.length) {
    return (
      <p className="card muted">
        Aún no encontramos puestos con tus competencias. Completa tu diagnóstico o agrega ejemplos
        en tu perfil.
      </p>
    );
  }
  return (
    <>
      {busy && <p role="status">Generando el pasaporte para el puesto seleccionado…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="job-grid" aria-busy={busy}>
        {jobs.map((j) => (
          <JobCard key={j.jobId} job={j} isTarget={profile?.target === j.jobId} onPlan={plan} />
        ))}
      </div>
    </>
  );
}
