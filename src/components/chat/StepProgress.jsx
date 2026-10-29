import { Check } from 'lucide-react';

/** Indicador de pasos del diagnóstico ("Paso 2 de 6"). */
export function StepProgress({ progress }) {
  if (!progress) return null;
  const { steps, current, total } = progress;
  const finished = current >= total;
  return (
    <div className="steps" aria-label="Progreso del diagnóstico">
      <p className="steps-label">
        {finished
          ? 'Diagnóstico completo'
          : `Paso ${current + 1} de ${total} · ${steps[current]?.label}`}
      </p>
      <ol className="steps-track">
        {steps.map((s, i) => {
          const state = i < current ? 'is-done' : i === current && !finished ? 'is-current' : '';
          return (
            <li
              key={s.id}
              className={state}
              aria-current={i === current && !finished ? 'step' : undefined}
            >
              <span className="steps-dot" aria-hidden="true">
                {i < current ? <Check strokeWidth={3} /> : i + 1}
              </span>
              <span className="steps-name">{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
