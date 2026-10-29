import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTarget } from '../../services/engine/targets.js';
import { kallpaService } from '../../services/kallpaService.js';
import { useKallpa } from '../../state/useKallpa.js';

/** Explicit action: the server retrieves its cached passport or generates it for this job. */
export function PassportButton({ occupationId, className = 'btn', children = 'Ver mi pasaporte' }) {
  const { profile, dispatch, isDemo } = useKallpa();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const open = async () => {
    if (!occupationId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const simulation = isDemo || kallpaService.mode === 'mock';
      const passport = simulation
        ? kallpaService.createDemoPassport(profile, occupationId, getTarget(occupationId, profile))
        : await kallpaService.createPassport(profile.profileId, occupationId);
      if (!passport || passport.occupationId !== occupationId) throw new Error('El pasaporte recibido no corresponde al empleo de esta ruta.');
      if (simulation) dispatch({ type: 'passport/store', passport });
      navigate(`/pasaporte?puesto=${encodeURIComponent(occupationId)}`, { state: simulation ? null : { passport } });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="passport-open-action">
    <button type="button" className={className} onClick={open} disabled={!occupationId || busy} aria-busy={busy}>{busy ? 'Preparando pasaporte…' : children}</button>
    {busy && <span className="sr-only" role="status">Preparando el pasaporte del empleo seleccionado.</span>}
    {error && <p className="text-sm" role="alert">{error}</p>}
  </div>;
}
