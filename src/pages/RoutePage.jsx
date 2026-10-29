import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ExternalLink,
  Eye,
  GraduationCap,
  Hammer,
  Waypoints,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DemandPanel } from '../components/map/MatchParts.jsx';
import { BackLink } from '../components/ui/BackLink.jsx';
import { EmptyProfile } from '../components/ui/EmptyState.jsx';
import { LoadingNotice } from '../components/ui/LoadingNotice.jsx';
import { FictionNotice, InfoNotice } from '../components/ui/Notice.jsx';
import { OccIcon } from '../components/ui/OccIcon.jsx';
import { COMPETENCIES } from '../data/competencies.js';
import { OCCUPATIONS } from '../data/occupations.js';
import { useAsync } from '../hooks/useAsync.js';
import { hasProfile } from '../services/engine/profile.js';
import { PRIORITY_LABELS, routeProgress } from '../services/engine/routeBuilder.js';
import { getTarget } from '../services/engine/targets.js';
import { joinNames } from '../services/engine/text.js';
import { kallpaService } from '../services/kallpaService.js';
import { PassportButton } from '../components/ui/PassportButton.jsx';
import { useKallpa } from '../state/useKallpa.js';
import './route.css';

const ACTIVITY_ICONS = { practica: Hammer, observa: Eye, curso: GraduationCap };
const ACTIVITY_LABELS = { practica: 'Practica', observa: 'Observa', curso: 'Curso' };

/** Ícono del objetivo: el de la ocupación o, si es un puesto, un maletín. */
function TargetIcon({ id }) {
  if (OCCUPATIONS[id]) return <OccIcon id={id} size="sm" />;
  return (
    <span className="occ-icon sm target-icon" aria-hidden="true">
      <BriefcaseBusiness strokeWidth={2} />
    </span>
  );
}

function RouteItem({ item, done, onToggle, occupationId }) {
  const checkId = `ri-${item.id}`;
  // Ruta del servidor: `link` es el enlace y `action` el texto de la acción.
  // Ruta local (modo demostración): `action` es el enlace.
  const link = item.link || (item.action && typeof item.action === 'object' ? item.action : null);
  return (
    <li className={`route-item ${done ? 'is-done' : ''}`}>
      <div className="route-check">
        <input id={checkId} type="checkbox" checked={done} onChange={onToggle} />
        <span className="route-box" aria-hidden="true">
          <Check strokeWidth={3} />
        </span>
      </div>
      <div className="route-content">
        <label htmlFor={checkId} className="route-title">
          {item.title}
        </label>
        {item.priority && (
          <span className={`badge prio prio-${item.priority}`}>
            {PRIORITY_LABELS[item.priority]}
          </span>
        )}
        {item.objective ? (
          <dl className="route-fields text-sm">
            <div>
              <dt>Objetivo</dt>
              <dd>{item.objective}</dd>
            </div>
            <div>
              <dt>Por qué</dt>
              <dd>{item.why}</dd>
            </div>
            <div>
              <dt>Qué hacer</dt>
              <dd>{item.action}</dd>
            </div>
            <div>
              <dt>Listo cuando</dt>
              <dd>{item.doneWhen}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted text-sm">{item.detail}</p>
        )}
        {item.baseId && (
          <p className="route-base text-sm">
            <Waypoints aria-hidden="true" />
            <span>
              Tu base: <strong>{COMPETENCIES[item.baseId].name}</strong>
            </span>
          </p>
        )}
        {item.activities && (
          <ul className="route-acts" role="list">
            {item.activities.map((a) => {
              const Icon = ACTIVITY_ICONS[a.type];
              return (
                <li key={a.text}>
                  <span className={`act act-${a.type}`}>
                    <Icon aria-hidden="true" />
                    {ACTIVITY_LABELS[a.type]}
                  </span>
                  <span>{a.text}</span>
                </li>
              );
            })}
          </ul>
        )}
        {item.list && (
          <ul className="route-list text-sm">
            {item.list.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <div className="row route-links">
          {item.resource && (
            <a
              href={item.resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
            >
              {item.resource.name}
              <ExternalLink aria-hidden="true" />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          )}
          {link?.to?.startsWith('/pasaporte') ? (
            <PassportButton occupationId={occupationId} className="btn btn-sm">{link.label}<ArrowRight aria-hidden="true" /></PassportButton>
          ) : link && (
            <Link to={link.to} className="btn btn-sm">
              {link.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

/** Une el progreso guardado en PostgreSQL con el de este navegador (un paso hecho en cualquiera cuenta). */
function mergeProgress(server = {}, local = {}) {
  const merged = { ...server };
  for (const [k, v] of Object.entries(local)) if (v) merged[k] = true;
  return merged;
}
const sameKeys = (a, b) => {
  const on = (o) =>
    Object.keys(o)
      .filter((k) => o[k])
      .sort()
      .join('|');
  return on(a) === on(b);
};

export default function RoutePage() {
  const { profile, dispatch, isDemo } = useKallpa();
  const current = profile?.experience?.occupations || [];
  // La ruta es SOLO para el puesto que la persona eligió con «Crear mi ruta» en «Puestos».
  const target = profile?.target && getTarget(profile.target, profile) ? profile.target : null;
  // Solo se regenera si cambia lo que la define (no al marcar un paso).
  const {
    data: routeData,
    error,
    loading,
  } = useAsync(
    () => (hasProfile(profile) && target ? kallpaService.buildRoute(profile, target) : null),
    [target, profile?.competencies, profile?.dismissed, profile?.experience, profile?.profileId],
  );
  // Al cambiar de puesto no se muestra la ruta anterior mientras llega la nueva.
  const route = routeData && routeData.occupationId === target ? routeData : null;
  const saved = Boolean(route?.persistence?.saved);
  const profileId = profile?.profileId;

  // Al abrir una ruta guardada: se juntan el progreso del servidor y el local.
  useEffect(() => {
    if (!saved || isDemo || !route?.progress) return;
    const local = profile.routeProgress?.[target] || {};
    const merged = mergeProgress(route.progress, local);
    if (!sameKeys(merged, local))
      dispatch({ type: 'route/setProgress', occupationId: target, progress: merged });
    if (!sameKeys(merged, route.progress))
      kallpaService.saveRouteProgress(profileId, target, merged).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  if (!hasProfile(profile) || !target) {
    return (
      <div className="page">
        <BackLink to="/ocupaciones" label="Puestos" />
        <header className="page-header">
          <div>
            <p className="eyebrow">Ruta laboral</p>
            <h1>Tu ruta laboral</h1>
          </div>
        </header>
        {hasProfile(profile) ? (
          <section className="card next-card">
            <div>
              <h2>Primero elige un puesto</h2>
              <p className="muted">
                Tu ruta se arma para el puesto que decidas. En «Puestos», abre el que te interesa y
                pulsa «Crear mi ruta».
              </p>
            </div>
            <Link to="/ocupaciones" className="btn btn-primary btn-lg">
              Ver puestos
              <ArrowRight aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <EmptyProfile text="Tu ruta se arma con las competencias que reconozcas en el diagnóstico. Empieza conversando con Kalna." />
        )}
      </div>
    );
  }

  const local = getTarget(target, profile);
  // El nombre y el tipo del destino los da el servidor (la ruta se arma para ese id).
  const o = route?.target ? { ...local, ...route.target } : local;
  const progressMap = profile.routeProgress?.[target] || {};
  const prog = route ? routeProgress(route, progressMap) : { done: 0, total: 0, ratio: 0 };
  const isCurrent = current.includes(target);
  const cmp = route?.comparison;
  const setTarget = (id) => dispatch({ type: 'profile/target', occupationId: id });
  const toggle = (itemId) => {
    if (!profile.target) setTarget(target);
    dispatch({ type: 'route/toggle', occupationId: target, itemId });
    if (saved && !isDemo) {
      const next = { ...progressMap, [itemId]: !progressMap[itemId] };
      kallpaService.saveRouteProgress(profileId, target, next).catch(() => {});
    }
  };

  return (
    <div className="page route">
      <BackLink to="/ocupaciones" label="Puestos" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Ruta laboral</p>
          <h1>
            {isCurrent ? 'Tu ruta para crecer como ' : 'Tu ruta hacia '}
            {o.name.toLowerCase()}
          </h1>
          {o.synthetic && (
            <p className="muted text-sm">
              Puesto de referencia (sintético): la ruta te orienta; las ofertas vigentes están en
              Empleos Perú.
            </p>
          )}
        </div>
        <Link to="/ocupaciones" className="btn">
          Cambiar de puesto
        </Link>
      </header>

      {error && (
        <InfoNotice tone="fiction">
          No se pudo crear tu ruta: {error.message} Vuelve a intentarlo en unos segundos.
        </InfoNotice>
      )}

      {!route && loading && !error && (
        <LoadingNotice title={`Creando tu ruta hacia ${o.name.toLowerCase()}…`}>
          Comparamos tu perfil con lo que pide el puesto y la IA redacta tus actividades. Puede
          tardar unos segundos.
        </LoadingNotice>
      )}

      {route && (
        <>
          <p className="muted text-sm route-saved" role="status">
            {saved
              ? 'Tu ruta y tu avance se guardan en tu perfil de Kalna.'
              : isDemo
                ? 'Ruta de demostración: no se guarda.'
                : 'Tu avance se guarda solo en este navegador.'}
          </p>
          <section className="route-summary card" aria-label="Resumen de tu ruta">
            <div className="route-journey">
              <div>
                <span className="field-label">Ahora</span>
                <p className="route-now">
                  {current.length
                    ? joinNames(current.map((c) => OCCUPATIONS[c].name))
                    : 'Tu experiencia'}
                </p>
              </div>
              <ArrowRight className="route-arrow" aria-hidden="true" />
              <div>
                <span className="field-label">Objetivo</span>
                <p className="route-now">
                  <TargetIcon id={target} /> {o.name}
                </p>
              </div>
            </div>
            <div className="route-progress">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>Tu avance</strong>
                <span className="text-sm muted" role="status">
                  {prog.done} de {prog.total} pasos
                </span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-label="Avance de la ruta"
                aria-valuemin={0}
                aria-valuemax={prog.total}
                aria-valuenow={prog.done}
              >
                <span style={{ width: `${prog.ratio * 100}%` }} />
              </div>
            </div>
            <div className="grid-2">
              <div>
                <h2 className="route-h">Competencias que puedes transferir</h2>
                {cmp.matches.length || cmp.transferable.length ? (
                  <ul className="route-tags" role="list">
                    {cmp.matches.map((m) => (
                      <li key={m.id} className="is-match">
                        {COMPETENCIES[m.id].name}
                      </li>
                    ))}
                    {cmp.transferable.map((t) => (
                      <li key={t.id} className="is-transfer">
                        {COMPETENCIES[t.base.id].name}{' '}
                        <small>→ base para {COMPETENCIES[t.id].name.toLowerCase()}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">Aún no aparecen. Tu ruta empieza desde las bases.</p>
                )}
              </div>
              <div>
                <h2 className="route-h">Brechas prioritarias</h2>
                {route.priorityGaps.length ? (
                  <ol className="route-gaps">
                    {route.priorityGaps.map((g) => (
                      <li key={g.id}>
                        <strong>{COMPETENCIES[g.id].name}</strong>
                        <span className={`badge prio prio-${g.priority}`}>
                          {PRIORITY_LABELS[g.priority]}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted text-sm">
                    No hay brechas en este modelo de referencia. Enfócate en respaldar tus
                    competencias.
                  </p>
                )}
              </div>
            </div>
            <DemandPanel occupationId={target} />
          </section>

          <ol className="route-stages">
            {route.stages.map((st, i) => {
              const doneCount = st.items.filter((it) => progressMap[it.id]).length;
              return (
                <li key={st.id} className="route-stage">
                  <div className="route-stage-num" aria-hidden="true">
                    {doneCount === st.items.length && st.items.length ? (
                      <Check strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <section className="card route-stage-card" aria-labelledby={`st-${st.id}`}>
                    <header className="route-stage-head">
                      <div>
                        <p className="eyebrow">Etapa {i + 1}</p>
                        <h2 id={`st-${st.id}`}>{st.title}</h2>
                        <p className="muted text-sm">{st.description}</p>
                      </div>
                      <span className="badge badge-neutral">
                        {doneCount}/{st.items.length}
                      </span>
                    </header>
                    {st.items.length > 0 && (
                      <ul className="route-items" role="list">
                        {st.items.map((it) => (
                          <RouteItem
                            key={it.id}
                            item={it}
                            done={Boolean(progressMap[it.id])}
                            onToggle={() => toggle(it.id)}
                            occupationId={target}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <FictionNotice>
        <strong>Ruta orientativa.</strong> Kalna no inventa cursos ni vacantes: enlaza a portales
        públicos para que busques opciones vigentes. Más adelante podrá incorporar datos de demanda
        laboral regional.
      </FictionNotice>

      <section className="card next-card">
        <div>
          <h2>Prepara tu CV para este puesto</h2>
          <p className="muted">
            Tu CV usa tus datos y las competencias que respaldaste con ejemplos. Tu pasaporte reúne
            esas competencias y ejemplos.
          </p>
        </div>
        <div className="row">
          <PassportButton occupationId={target} className="btn btn-lg" />
        </div>
      </section>
    </div>
  );
}
