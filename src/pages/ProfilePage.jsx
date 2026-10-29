import { ArrowRight, ClipboardCheck, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CompetencyCard } from '../components/profile/CompetencyCard.jsx';
import { BackLink } from '../components/ui/BackLink.jsx';
import { EmptyProfile } from '../components/ui/EmptyState.jsx';
import { OccPill } from '../components/ui/OccIcon.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { STATUS_HELP } from '../services/engine/statusHelp.js';
import { useToast } from '../components/ui/toastContext.js';
import { COMPETENCIES, FAMILY_ORDER } from '../data/competencies.js';
import { OCCUPATIONS } from '../data/occupations.js';
import { DURATION_LABELS, FORMALITY_DISPLAY } from '../services/engine/diagnosisFlow.js';
import {
  STATUS,
  activeCompetencies,
  dismissCompetency,
  hasProfile,
  restoreDismissed,
  statusCounts,
} from '../services/engine/profile.js';
import { kallpaService } from '../services/kallpaService.js';
import { useKallpa } from '../state/useKallpa.js';
import './profile.css';

const STATUS_ORDER = ['evidencia', 'declarada', 'por_validar'];
const EMPTY_TEXT = {
  evidencia:
    'Aún no tienes competencias con evidencia. Agrega un ejemplo concreto a una competencia declarada.',
  declarada: 'No tienes competencias declaradas pendientes de respaldar.',
  por_validar: 'No tienes competencias por validar.',
};

export default function ProfilePage() {
  const { profile, dispatch, isDemo } = useKallpa();
  const toast = useToast();
  const [params] = useSearchParams();
  const focusId = params.get('c');
  const [tab, setTab] = useState(null);

  if (!hasProfile(profile)) {
    return (
      <div className="page">
        <BackLink to="/diagnostico" label="Diagnóstico" />
        <header className="page-header">
          <div>
            <p className="eyebrow">Paso 2 · Perfil de competencias</p>
            <h1>Tu perfil de competencias</h1>
          </div>
        </header>
        <EmptyProfile />
      </div>
    );
  }

  const counts = statusCounts(profile);
  const items = activeCompetencies(profile);
  const familyRank = (c) => FAMILY_ORDER.indexOf(COMPETENCIES[c.id].family);
  const byStatus = (status) =>
    items.filter((c) => c.status === status).sort((a, b) => familyRank(a) - familyRank(b));
  const focusStatus = items.find((c) => c.id === focusId)?.status;
  const active = tab || focusStatus || STATUS_ORDER.find((st) => counts[st] > 0) || STATUS_ORDER[0];
  const visible = byStatus(active);
  const exp = profile.experience;

  const addExample = async (id, text) => {
    const r = await kallpaService.addEvidence(profile, id, text);
    dispatch({ type: 'profile/set', profile: r.profile });
    if (r.persistence && !r.persistence.saved)
      toast.show(`${r.persistence.error} El ejemplo quedó solo en este navegador.`);
    else if (r.level === 'fuerte')
      toast.show(`«${COMPETENCIES[id].name}» ahora figura con evidencia.`);
    return { level: r.level, mismatch: r.mismatch || null };
  };

  // Guarda el cambio también en el servidor (modo qvac); en modo demostración no hace nada.
  const persist = (next) => kallpaService.saveProfile(next).catch(() => {});

  const dismiss = (id) => {
    const before = profile;
    const next = dismissCompetency(profile, id);
    dispatch({ type: 'profile/set', profile: next });
    persist(next);
    toast.show(`Quitaste «${COMPETENCIES[id].name}» de tu perfil.`, {
      action: {
        label: 'Deshacer',
        onClick: () => {
          dispatch({ type: 'profile/set', profile: before });
          persist(before);
        },
      },
    });
  };

  return (
    <div className="page profile">
      <BackLink to="/diagnostico" label="Diagnóstico" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Paso 2 · Perfil de competencias</p>
          <h1>{profile.alias ? `Perfil de ${profile.alias}` : 'Tu perfil de competencias'}</h1>
        </div>
        <div className="row">
          <Link to="/ocupaciones" className="btn btn-primary">
            Ver puestos recomendados
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="card profile-exp" aria-label="Tu experiencia">
        <div className="row">
          {exp.occupations.map((o) => (
            <OccPill key={o} id={o}>
              {OCCUPATIONS[o].name}
            </OccPill>
          ))}
        </div>
        <dl className="profile-dl">
          {exp.formality && (
            <div>
              <dt>Tipo de experiencia</dt>
              <dd>{FORMALITY_DISPLAY[exp.formality]}</dd>
            </div>
          )}
          {exp.duration && (
            <div>
              <dt>Tiempo</dt>
              <dd>{DURATION_LABELS[exp.duration]}</dd>
            </div>
          )}
        </dl>
        {isDemo && <p className="badge badge-fiction">Caso ficticio de demostración</p>}
      </section>

      <section className="stack" aria-labelledby="skills-title">
        <h2 id="skills-title" className="sr-only">
          Tus competencias
        </h2>
        <div className="status-tabs" role="tablist" aria-label="Competencias por estado">
          {STATUS_ORDER.map((st) => (
            <button
              key={st}
              type="button"
              role="tab"
              id={`tab-${st}`}
              aria-selected={active === st}
              aria-controls="status-panel"
              className={`status-tab status-tab-${st}`}
              onClick={() => setTab(st)}
            >
              <span className="status-tab-head">
                <span className="stat-value">{counts[st]}</span>
                <StatusBadge status={st} />
              </span>
              <span className="muted text-sm">{STATUS_HELP[st]}</span>
            </button>
          ))}
        </div>

        <div id="status-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
          {visible.length ? (
            <div className="skill-grid">
              {visible.map((c) => (
                <CompetencyCard
                  key={c.id}
                  competency={c}
                  onAddExample={addExample}
                  onDismiss={dismiss}
                  focus={focusId === c.id}
                />
              ))}
            </div>
          ) : (
            <p className="card muted">{EMPTY_TEXT[active]}</p>
          )}
          {active === 'evidencia' && visible.length > 0 && (
            <div className="card assess-cta">
              <div>
                <p className="card-title">Valida lo que ya sabes hacer</p>
                <p className="muted text-sm">
                  Responde situaciones laborales y obtén tu constancia de evaluación.
                </p>
              </div>
              <Link to="/evaluacion" className="btn btn-primary">
                <ClipboardCheck aria-hidden="true" />
                Validar competencias
              </Link>
            </div>
          )}
        </div>
      </section>

      {profile.analysis?.ok && profile.analysis.missingInformation?.length > 0 && (
        <section className="card" aria-labelledby="missing-title">
          <h2 id="missing-title" className="card-title">
            Lo que falta saber
          </h2>
          <p className="muted text-sm">
            Al revisar tu relato, esto quedó pendiente para confirmar o evaluar mejor tus
            competencias. Puedes contarlo agregando ejemplos.
          </p>
          <ul className="text-sm">
            {profile.analysis.missingInformation.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {profile.dismissed.length > 0 && (
        <section className="card" aria-labelledby="dismissed-title">
          <h2 id="dismissed-title" className="card-title">
            Competencias que quitaste
          </h2>
          <p className="muted text-sm">
            No se usarán en la comparación ni en tu ruta. Si cambias de opinión, puedes
            recuperarlas.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            {profile.dismissed.map((id) => (
              <button
                key={id}
                type="button"
                className="chip chip-sm"
                onClick={() => {
                  const next = restoreDismissed(profile, id);
                  dispatch({ type: 'profile/set', profile: next });
                  persist(next);
                }}
              >
                <RotateCcw aria-hidden="true" />
                {COMPETENCIES[id].name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
