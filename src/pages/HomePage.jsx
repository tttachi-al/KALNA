import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  EyeOff,
  Footprints,
  LockKeyhole,
  MessagesSquare,
  ScanSearch,
  Scale,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OccIcon } from '../components/ui/OccIcon.jsx';
import { FictionNotice } from '../components/ui/Notice.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { kallpaService } from '../services/kallpaService.js';
import { STATUS_HELP } from '../services/engine/statusHelp.js';
import { hasProfile, statusCounts } from '../services/engine/profile.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useReveal } from '../hooks/useReveal.js';
import { useKallpa } from '../state/useKallpa.js';
import './home.css';

const STEPS = [
  {
    icon: MessagesSquare,
    title: 'Cuenta',
    text: 'Conversa sobre tus tareas, herramientas, responsabilidades y situaciones que resolviste.',
  },
  {
    icon: BadgeCheck,
    title: 'Reconoce',
    text: 'Descubre qué competencias aparecen en tu relato y respáldalas con ejemplos.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Postula',
    text: 'Recibe puestos recomendados según tus competencias y postula en Empleos Perú.',
  },
  {
    icon: Footprints,
    title: 'Avanza',
    text: 'Sigue una ruta con pasos concretos y arma tu pasaporte de competencias.',
  },
];

const PRINCIPLES = [
  {
    icon: ScanSearch,
    title: 'No asumimos',
    text: 'Haber trabajado en una ocupación no significa tener todas sus competencias. Las reconocemos por lo que cuentas.',
  },
  {
    icon: Scale,
    title: 'No certificamos',
    text: 'Kalna te ayuda a reconocer y respaldar competencias. No reemplaza una certificación oficial.',
  },
  {
    icon: EyeOff,
    title: 'No inventamos',
    text: 'No mostramos vacantes ni afirmamos que una ocupación tenga alta demanda sin datos que lo respalden.',
  },
  {
    icon: LockKeyhole,
    title: 'Cuidamos tus datos',
    text: 'En esta versión todo queda en tu navegador. Puedes borrarlo cuando quieras.',
  },
];

function ContinueCard() {
  const { state, profile, isDemo } = useKallpa();
  const session = state.diagnosis?.session;
  if (isDemo || (!session && !hasProfile(profile))) return null;
  const counts = statusCounts(profile);
  const done = session?.done;
  return (
    <section className="card continue rise" aria-labelledby="continue-title">
      <span className="continue-icon" aria-hidden="true">
        <UserRound />
      </span>
      <div className="spacer">
        <h2 id="continue-title">
          {profile.alias ? `Hola de nuevo, ${profile.alias}` : 'Hola de nuevo'}
        </h2>
        <p className="muted text-sm">
          {done
            ? `Tu perfil tiene ${counts.total} competencia${counts.total === 1 ? '' : 's'}: ${counts.evidencia} con evidencia.`
            : 'Tienes un diagnóstico sin terminar. Puedes continuar donde lo dejaste.'}
        </p>
      </div>
      <Link className="btn btn-primary" to={done ? '/perfil' : '/diagnostico'}>
        {done ? 'Ver mi perfil' : 'Continuar diagnóstico'}
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

/** Duración de cada fase de la vista previa (ms). La última se mantiene antes de reiniciar. */
const PHASES = [900, 1300, 1100, 1000, 1400, 12000];
const LAST = PHASES.length - 1;

/**
 * Vista previa ilustrativa que se reproduce sola: pregunta → respuesta →
 * la competencia pasa de «Declarada» a «Con evidencia» → base transferible.
 * Con movimiento reducido se muestra directamente el estado final.
 */
function HeroPreview() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  const phase = reduced ? LAST : tick;

  useEffect(() => {
    if (reduced) return undefined;
    const t = setTimeout(() => setTick((p) => (p >= LAST ? 0 : p + 1)), PHASES[tick]);
    return () => clearTimeout(t);
  }, [tick, reduced]);

  const at = (n) => (phase >= n ? 'is-in' : '');
  return (
    <div className={`hero-preview ${phase === LAST ? 'is-done' : ''}`} aria-hidden="true">
      <div className="hp-card hp-chat is-in">
        <span className="hp-bot">K</span>
        <p>Sobre «Control de suministros»: ¿me cuentas un ejemplo concreto?</p>
      </div>
      <div className={`hp-card hp-user ${at(1)}`}>
        {phase < 2 ? (
          <span className="hp-typing">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <p>Cada lunes reviso el depósito y anoto lo que falta…</p>
        )}
      </div>
      <div className={`hp-card hp-skill ${at(3)}`}>
        <div className={`hp-skill-row ${phase >= 4 ? 'is-upgraded' : ''}`}>
          <strong>Control de suministros</strong>
          <StatusBadge status={phase >= 4 ? 'evidencia' : 'declarada'} />
        </div>
        <div className="hp-skill-row">
          <strong>Organización de materiales</strong>
          <StatusBadge status="declarada" />
        </div>
        <div className={`hp-path ${at(5)}`}>
          <OccIcon id="limpieza" size="sm" />
          <span className="hp-line" />
          <OccIcon id="reponedor" size="sm" />
          <small>Base transferible hacia reposición</small>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const revealRef = useReveal();
  return (
    <div className="page home" ref={revealRef}>
      <ContinueCard />

      <section className="hero on-night" aria-labelledby="hero-title">
        <div className="hero-copy hero-enter">
          <p className="eyebrow hero-eyebrow">Competencias laborales · Perú</p>
          <h1 id="hero-title">
            Descubre <span>tu potencial.</span>
          </h1>
          <p className="hero-lead">
            Kalna conversa contigo sobre tu trabajo y te ayuda a reconocer lo que ya sabes hacer,
            aunque lo hayas aprendido trabajando y sin certificados.
          </p>
          <div className="row hero-ctas">
            <Link className="btn btn-gold btn-lg hero-cta" to="/diagnostico">
              <MessagesSquare aria-hidden="true" />
              Empezar diagnóstico
              <ArrowRight className="hero-cta-arrow" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <HeroPreview />
      </section>

      <section className="stack" aria-labelledby="how-title">
        <h2 id="how-title" data-reveal>
          Cómo funciona Kalna
        </h2>
        <ol className="how-grid" aria-label="Pasos del recorrido">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="card how-step"
              data-reveal
              style={{ '--reveal-delay': `${i * 90}ms` }}
            >
              <span className="how-num" aria-hidden="true">
                {i + 1}
              </span>
              <s.icon className="how-icon" aria-hidden="true" />
              <h3 className="how-title">{s.title}</h3>
              <p className="muted text-sm">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid-2" aria-label="Cómo leer tus resultados y compromisos">
        <div className="card" data-reveal>
          <h2 className="card-title">Cómo leer tus competencias</h2>
          <ul className="status-legend" role="list">
            {['evidencia', 'declarada', 'por_validar'].map((s) => (
              <li key={s}>
                <StatusBadge status={s} />
                <span className="text-sm">{STATUS_HELP[s]}</span>
              </li>
            ))}
          </ul>
          <p className="muted text-sm" style={{ marginTop: 12 }}>
            Ningún estado es una certificación. Son un punto de partida para reconocer y respaldar
            lo que sabes.
          </p>
        </div>
        <div className="card" data-reveal style={{ '--reveal-delay': '120ms' }}>
          <h2 className="card-title">Nuestros compromisos</h2>
          <ul className="principles" role="list">
            {PRINCIPLES.map((p) => (
              <li key={p.title}>
                <p.icon aria-hidden="true" />
                <div>
                  <strong>{p.title}.</strong> <span className="muted text-sm">{p.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <details className="disclosure">
        <summary>
          Cómo está construido (para el equipo técnico)
          <ChevronDown className="chev" aria-hidden="true" />
        </summary>
        <div className="disclosure-body stack">
          <p className="muted text-sm">
            Todas las pantallas piden datos a un único servicio. Hoy responde el motor de
            demostración local; más adelante, el backend con QVAC, sin cambiar las pantallas.
          </p>
          <div
            className="arch"
            role="img"
            aria-label="Pantallas React, luego kallpaService, luego el adaptador de demostración activo o el adaptador QVAC por conectar, que llama al backend y a QVAC."
          >
            <div className="arch-box">Pantallas React</div>
            <ArrowRight className="arch-arrow" aria-hidden="true" />
            <div className="arch-box arch-strong">
              kallpaService.js
              <small>punto único de datos</small>
            </div>
            <ArrowRight className="arch-arrow" aria-hidden="true" />
            <div className="arch-col">
              <div className={`arch-box ${kallpaService.mode === 'mock' ? 'arch-on' : ''}`}>
                mockAdapter.js
                <small>
                  {kallpaService.mode === 'mock' ? 'activo · datos de demostración' : 'disponible'}
                </small>
              </div>
              <div className={`arch-box ${kallpaService.mode === 'qvac' ? 'arch-on' : 'arch-off'}`}>
                qvacAdapter.js → Backend → QVAC
                <small>{kallpaService.mode === 'qvac' ? 'activo' : 'por conectar'}</small>
              </div>
            </div>
          </div>
        </div>
      </details>

      <FictionNotice />
    </div>
  );
}
