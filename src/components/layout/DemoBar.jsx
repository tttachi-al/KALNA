import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_STEPS, stepDuration } from '../../data/demoSteps.js';
import { useKallpa } from '../../state/useKallpa.js';
import { useToast } from '../ui/toastContext.js';

/** Barra de control del Modo demostración (pasos, reproducción y salida). */
export function DemoBar() {
  const { state, dispatch } = useKallpa();
  const navigate = useNavigate();
  const toast = useToast();
  const { active, step, playing, data } = state.demo;
  // El tiempo transcurrido va ligado a su paso: al cambiar de paso vale 0 desde el
  // primer render. (Reiniciarlo en un efecto dejaba un render con el tiempo del paso
  // anterior y, si ese paso era más largo, se saltaba el siguiente.)
  const stepKey = `${active}-${step}`;
  const [timer, setTimer] = useState({ key: stepKey, ms: 0 });
  const elapsed = timer.key === stepKey ? timer.ms : 0;
  const last = useRef(null);

  const current = DEMO_STEPS[step];
  const duration = current ? stepDuration(current, data) : 0;
  const isLast = step === DEMO_STEPS.length - 1;

  // Temporizador con pausa
  useEffect(() => {
    if (!active || !playing) return undefined;
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last.current;
      last.current = now;
      setTimer((t) => ({ key: stepKey, ms: (t.key === stepKey ? t.ms : 0) + dt }));
    }, 100);
    return () => clearInterval(id);
  }, [active, playing, stepKey]);

  useEffect(() => {
    if (!active || !playing || elapsed < duration) return;
    if (isLast) dispatch({ type: 'demo/playing', playing: false });
    else dispatch({ type: 'demo/step', step: step + 1 });
  }, [elapsed, duration, active, playing, isLast, step, dispatch]);

  if (!active || !current) return null;

  const go = (n) =>
    dispatch({ type: 'demo/step', step: Math.max(0, Math.min(DEMO_STEPS.length - 1, n)) });
  const exit = () => {
    dispatch({ type: 'demo/exit' });
    navigate('/');
    toast.show('Saliste del modo demostración. Tus datos siguen intactos.');
  };
  const pct = Math.min(100, (elapsed / duration) * 100);

  return (
    <section className="demobar on-night" aria-label="Modo demostración">
      <div className="demobar-inner">
        <div className="demobar-info">
          <p className="demobar-meta">
            <span className="demobar-tag">
              Demo<span className="hide-sm">stración</span> · caso ficticio
            </span>
            <span className="demobar-count" aria-live="polite">
              Paso {step + 1} de {DEMO_STEPS.length}
            </span>
          </p>
          <h2 className="demobar-title">{current.title}</h2>
          <p className="demobar-text">{current.text}</p>
        </div>

        <div className="demobar-actions">
          <div className="demobar-controls">
            <button
              type="button"
              className="demobar-btn"
              onClick={() => go(step - 1)}
              disabled={step === 0}
              aria-label="Paso anterior"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="demobar-btn demobar-play"
              onClick={() => dispatch({ type: 'demo/playing', playing: !playing })}
              aria-label={playing ? 'Pausar demostración' : 'Reproducir demostración'}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="demobar-btn"
              onClick={() => go(step + 1)}
              disabled={isLast}
              aria-label="Paso siguiente"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="btn btn-night btn-sm demobar-exit" onClick={exit}>
            <X aria-hidden="true" />
            Salir
          </button>
        </div>

        <ol className="demobar-steps" aria-label="Pasos de la demostración">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={i === step ? 'is-current' : i < step ? 'is-past' : ''}
                onClick={() => go(i)}
                aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                aria-current={i === step ? 'step' : undefined}
                title={s.title}
              >
                {i === step && <span style={{ width: `${pct}%` }} />}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
