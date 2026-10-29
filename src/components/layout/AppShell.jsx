import { Check, Ellipsis, LogIn, Menu, Moon, Play, Sun, Trash2, UserPlus, UserRound, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { kallpaService } from '../../services/kallpaService.js';
import { hasProfile } from '../../services/engine/profile.js';
import { useAuth } from '../../state/authContext.js';
import { useKallpa } from '../../state/useKallpa.js';
import { ConfirmDialog } from '../ui/Dialog.jsx';
import { Logo } from '../ui/Logo.jsx';
import { useToast } from '../ui/toastContext.js';
import { A11yToolbar } from './A11yToolbar.jsx';
import { DemoBar } from './DemoBar.jsx';
import { DemoController } from './DemoController.jsx';
import { DEMO_STEPS } from '../../data/demoSteps.js';
import { BOTTOM_ITEMS, HEADER_ITEMS, NAV_ITEMS, WIDE_ROUTES } from './nav.js';
import './layout.css';

const STEPS = NAV_ITEMS.filter((n) => n.step);

/** Índice del primer paso de la demostración que muestra cada página. */
const firstDemoStep = (route) => DEMO_STEPS.findIndex((s) => s.route === route);

function useJourneyDone() {
  const { state, profile, isDemo, explore } = useKallpa();
  if (isDemo) {
    // En la demostración, un paso del recorrido se marca cuando la demostración
    // ya avanzó a la página siguiente (no por el caso de María ya completo).
    const step = state.demo.step;
    return {
      '/diagnostico': step >= firstDemoStep('/perfil'),
      '/perfil': step >= firstDemoStep('/ocupaciones'),
      '/ocupaciones': Boolean(state.demo.profile?.targetSelected),
    };
  }
  const diagnosisDone = Boolean(state.diagnosis?.session?.done);
  return {
    '/diagnostico': diagnosisDone,
    '/perfil': diagnosisDone && hasProfile(profile),
    // «Puestos» se completa cuando la persona elige un puesto (crea su ruta o su pasaporte).
    '/ocupaciones': Boolean(explore || profile?.target),
  };
}

/** "Tu recorrido" solo aparece cuando la persona ya empezó a conversar (o en la demostración). */
function useJourneyStarted() {
  const { state, profile, isDemo } = useKallpa();
  const session = state.diagnosis?.session;
  return isDemo || hasProfile(profile) || Boolean(session && session.stage !== 'bienvenida');
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Tema que indica el sistema operativo, actualizado si cambia mientras la app está abierta. */
function useSystemTheme() {
  const [dark, setDark] = useState(() => window.matchMedia?.(DARK_QUERY).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark ? 'dark' : 'light';
}

/** Claro u oscuro. Mientras la persona no elija, se marca el tema del sistema. */
export function ThemeSwitch() {
  const { state, dispatch } = useKallpa();
  const systemTheme = useSystemTheme();
  const current = state.theme === 'system' ? systemTheme : state.theme;
  const options = [
    { id: 'light', label: 'Tema claro', icon: Sun },
    { id: 'dark', label: 'Tema oscuro', icon: Moon },
  ];
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Tema de color">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={current === o.id}
          aria-label={o.label}
          onClick={() => dispatch({ type: 'theme/set', theme: o.id })}
          title={o.label}
        >
          <o.icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function ModeTag() {
  const mock = kallpaService.mode === 'mock';
  return (
    <span
      className="mode-tag"
      title={
        mock ? 'Los datos se procesan solo en este navegador.' : 'Conectado al backend de Kalna.'
      }
    >
      <span className={`mode-dot ${mock ? '' : 'is-live'}`} aria-hidden="true" />
      {mock ? 'Datos de demostración (local)' : 'Backend QVAC'}
    </span>
  );
}

/** Pasos del recorrido en horizontal, debajo de la cabecera. */
function JourneyNav() {
  const done = useJourneyDone();
  return (
    <nav className="journey" aria-label="Tu recorrido">
      <div className="journey-inner">
        <span className="journey-label">Tu recorrido</span>
        <ol className="journey-steps">
          {STEPS.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} className={`journey-link ${done[n.to] ? 'is-done' : ''}`}>
                <span className="journey-num" aria-hidden="true">
                  {done[n.to] ? <Check strokeWidth={3} /> : n.step}
                </span>
                <span className="journey-text">
                  {n.label}
                  <small>{n.hint}</small>
                </span>
                {done[n.to] && <span className="sr-only">(completado)</span>}
              </NavLink>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

/** Cabecera fija: marca, acciones, recorrido y barra de demostración. Publica su alto en --appbar-h. */
/**
 * Acceso a la cuenta. Sin sesión: «Iniciar sesión» (secundaria) y «Crear cuenta»
 * (principal). Con sesión: «Mi cuenta», donde están cerrar sesión y eliminar cuenta.
 * En móvil la barra no tiene espacio: van al inicio de «Más opciones».
 */
function AccountLinks({ variant }) {
  const { user } = useAuth();
  if (user) {
    return (
      <NavLink to="/cuenta" className={variant === 'sheet' ? 'btn btn-block' : 'btn btn-sm topbar-account'}>
        <UserRound aria-hidden="true" />
        Mi cuenta
      </NavLink>
    );
  }
  const sheet = variant === 'sheet';
  return (
    <>
      <NavLink to="/iniciar-sesion" className={sheet ? 'btn btn-block' : 'btn btn-sm topbar-account'}>
        <LogIn aria-hidden="true" />
        Iniciar sesión
      </NavLink>
      <NavLink to="/crear-cuenta" className={sheet ? 'btn btn-primary btn-block' : 'btn btn-sm topbar-signup'}>
        <UserPlus aria-hidden="true" />
        Crear cuenta
      </NavLink>
    </>
  );
}

function AppBar({ started, onMenu, menuOpen }) {
  const { startDemo, isDemo } = useKallpa();
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = () =>
      document.documentElement.style.setProperty('--appbar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="appbar" ref={ref}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brands">
            <span className="topbar-gov">
              <strong className="topbar-gob">gob.pe</strong>
              <span className="topbar-ministry">
                Ministerio de Trabajo y<br />
                Promoción del Empleo
              </span>
            </span>
            <NavLink to="/" aria-label="Kalna, ir al inicio" className="topbar-brand">
              <Logo onNight />
            </NavLink>
          </div>
          <nav className="topbar-nav" aria-label="Principal">
            {HEADER_ITEMS.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="topbar-link">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <div className="topbar-auth">
              <AccountLinks variant="bar" />
            </div>
            {!isDemo && (
              <button type="button" className="btn btn-sm topbar-demo" onClick={startDemo}>
                <Play aria-hidden="true" />
                <span className="topbar-demo-long">Ver demostración</span>
                <span className="topbar-demo-short">Demo</span>
              </button>
            )}
            <button
              type="button"
              className="icon-btn topbar-menu"
              onClick={onMenu}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label="Más opciones"
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      {started && <JourneyNav />}
      <DemoBar />
    </div>
  );
}

function BottomNav({ onMore, moreOpen }) {
  const items = BOTTOM_ITEMS.map((to) => NAV_ITEMS.find((n) => n.to === to));
  const location = useLocation();
  const inMore = ['/', '/preguntas-frecuentes', '/iniciar-sesion', '/crear-cuenta', '/cuenta'].includes(location.pathname);
  return (
    <nav className="bottomnav" aria-label="Tu recorrido">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} className="bottom-link">
          <n.icon aria-hidden="true" />
          <span>{n.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={`bottom-link ${inMore ? 'active' : ''}`}
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-haspopup="dialog"
      >
        <Ellipsis aria-hidden="true" />
        <span>Más</span>
      </button>
    </nav>
  );
}

function MoreSheet({ open, onClose, onReset, started }) {
  const { startDemo, isDemo } = useKallpa();
  const location = useLocation();
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const links = [
    ...HEADER_ITEMS,
    ...(started ? NAV_ITEMS.filter((n) => !n.end && !BOTTOM_ITEMS.includes(n.to)) : []),
  ];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Más opciones">
        <div className="sheet-head">
          <strong>Más opciones</strong>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Cerrar"
            autoFocus
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="sheet-account">
          <AccountLinks variant="sheet" />
        </div>
        <nav className="sheet-links" aria-label="Otras secciones">
          {links.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="sheet-link">
              <n.icon aria-hidden="true" />
              <span>
                {n.label}
                {n.hint && <small>{n.hint}</small>}
              </span>
            </NavLink>
          ))}
        </nav>
        {!isDemo && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              onClose();
              startDemo();
            }}
          >
            <Play aria-hidden="true" />
            Ver demostración
          </button>
        )}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <ModeTag />
          {!isDemo && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
              <Trash2 aria-hidden="true" />
              Borrar mis datos
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { resetAll, isDemo } = useKallpa();
  const toast = useToast();
  const location = useLocation();
  const started = useJourneyStarted();
  // Las secciones de "Tu recorrido" aprovechan todo el ancho disponible
  const wide = WIDE_ROUTES.some((to) => location.pathname.startsWith(to));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className={`shell ${started ? 'has-journey' : ''}`}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <DemoController />
      <AppBar started={started} onMenu={() => setMoreOpen((v) => !v)} menuOpen={moreOpen} />
      <main id="contenido" className={`main ${wide ? 'is-wide' : ''}`} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className={`footer ${wide ? 'is-wide' : ''}`}>
        <p>
          Kalna · Prototipo de frontend con datos de demostración. Las historias y personas son
          ficticias. No es una certificación laboral oficial.
        </p>
        <div className="footer-tools">
          <ModeTag />
          {!isDemo && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmReset(true)}
            >
              <Trash2 aria-hidden="true" />
              Borrar mis datos
            </button>
          )}
        </div>
      </footer>
      {started && <BottomNav onMore={() => setMoreOpen((v) => !v)} moreOpen={moreOpen} />}
      <MoreSheet
        open={moreOpen}
        started={started}
        onClose={() => setMoreOpen(false)}
        onReset={() => setConfirmReset(true)}
      />
      <ThemeSwitch />
      <A11yToolbar />
      <ConfirmDialog
        open={confirmReset}
        title="¿Borrar tus datos de este navegador?"
        confirmLabel="Sí, borrar"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
          setMoreOpen(false);
          toast.show('Tus datos se borraron de este navegador.');
        }}
      >
        Se eliminarán tu conversación, tu perfil y el avance de tu ruta. Esta acción no se puede
        deshacer.
      </ConfirmDialog>
    </div>
  );
}
