import { BadgeCheck, ChevronDown, Lightbulb, Plus, ThumbsDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { COMPETENCIES } from '../../data/competencies.js';
import { OCCUPATIONS, OCCUPATION_IDS } from '../../data/occupations.js';
import { EVIDENCE_TIPS } from '../../services/engine/evidence.js';
import { SOURCE_LABELS } from '../../services/engine/profile.js';
import { OccPill } from '../ui/OccIcon.jsx';

const LEVEL_LABELS = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

/** Tarjeta plegable de una competencia del perfil: nombre arriba; respaldo y acciones al abrirla. */
export function CompetencyCard({ competency, onAddExample, onDismiss, focus = false }) {
  const meta = COMPETENCIES[competency.id];
  const [expanded, setExpanded] = useState(focus);
  const [open, setOpen] = useState(focus);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const ref = useRef(null);
  const fieldId = useId();
  const usedIn = OCCUPATION_IDS.filter((o) =>
    OCCUPATIONS[o].requires.some((r) => r.id === competency.id),
  );

  useEffect(() => {
    if (focus && ref.current) {
      ref.current.scrollIntoView({ block: 'center' });
      ref.current.querySelector('textarea')?.focus();
    }
  }, [focus]);

  const save = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    const { level, mismatch } = await onAddExample(competency.id, text.trim());
    setSaving(false);
    setFeedback({ level, mismatch });
    if (level === 'fuerte') {
      setText('');
      setOpen(false);
    }
  };

  return (
    <article
      className={`skill-card ${competency.status === 'evidencia' ? 'is-evidence' : ''}`}
      ref={ref}
      aria-labelledby={`${fieldId}-t`}
    >
      <h3 className="skill-head">
        <button
          type="button"
          className="skill-toggle"
          aria-expanded={expanded}
          aria-controls={`${fieldId}-body`}
          onClick={() => setExpanded((v) => !v)}
        >
          <span id={`${fieldId}-t`} className="skill-name">
            {meta.name}
          </span>
          <ChevronDown className="skill-chevron" aria-hidden="true" />
        </button>
      </h3>

      <div className="skill-body" id={`${fieldId}-body`} hidden={!expanded}>
        <p className="muted text-sm">{meta.description}</p>

        {competency.level && (
          <p className="text-sm">
            <strong>Nivel estimado: {LEVEL_LABELS[competency.level] || competency.level}.</strong>{' '}
            {competency.levelReason && <span className="muted">{competency.levelReason}</span>}
          </p>
        )}

        <div className="skill-occs">
          <span className="text-sm muted">Se usa en:</span>
          {usedIn.map((o) => (
            <OccPill key={o} id={o}>
              {OCCUPATIONS[o].short}
            </OccPill>
          ))}
        </div>

        <div className="skill-quotes">
          {competency.examples
            .slice()
            .reverse()
            .slice(0, 2)
            .map((ex, i) => (
              <blockquote
                key={`e${i}`}
                className={`quote ${ex.level === 'fuerte' ? 'is-evidence' : ''}`}
              >
                <span className="quote-meta">
                  {ex.level === 'fuerte' ? 'Ejemplo que la respalda' : 'Ejemplo por completar'}
                </span>
                “{ex.text}”
              </blockquote>
            ))}
          {competency.mentions
            .filter((m) => !competency.examples.some((ex) => ex.text === m.quote))
            .slice(0, competency.examples.length ? 1 : 2)
            .map((m, i) => (
              <blockquote key={`m${i}`} className="quote">
                <span className="quote-meta">
                  Lo que contaste · {SOURCE_LABELS[m.source] || m.source}
                </span>
                “{m.quote}”
              </blockquote>
            ))}
        </div>

        {feedback && !open && feedback.level === 'fuerte' && (
          <p className="notice notice-ok" role="status">
            <BadgeCheck aria-hidden="true" />
            <span>¡Listo! Tu ejemplo respalda esta competencia.</span>
          </p>
        )}

        {open ? (
          <form className="skill-form" onSubmit={save}>
            <label htmlFor={fieldId} className="field-label">
              Tu ejemplo concreto
            </label>
            <p className="field-help" id={`${fieldId}-h`}>
              {meta.ask}
            </p>
            <textarea
              id={fieldId}
              className="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby={`${fieldId}-h ${fieldId}-tips`}
              placeholder="Ej.: Cada semana…"
              maxLength={1200}
            />
            <p className="field-help" id={`${fieldId}-tips`}>
              Ayuda contar: {EVIDENCE_TIPS.join(' · ').toLowerCase()}.
            </p>
            {feedback && feedback.level !== 'fuerte' && (
              <p className="notice notice-fiction" role="status">
                <Lightbulb aria-hidden="true" />
                <span>
                  {feedback.mismatch
                    ? `Gracias. Este ejemplo parece hablar más de «${COMPETENCIES[feedback.mismatch].name}». Cuenta una situación de «${meta.name}» en particular.`
                    : 'Gracias. Para que el ejemplo la respalde, agrega más detalles: qué hiciste, cada cuánto o qué resultado tuvo.'}
                </span>
              </p>
            )}
            <div className="row">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!text.trim() || saving}
              >
                {saving ? 'Revisando…' : 'Guardar ejemplo'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="row skill-actions">
            {competency.status !== 'evidencia' && (
              <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden="true" />
                Agregar ejemplo
              </button>
            )}
            {competency.status === 'evidencia' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden="true" />
                Agregar otro ejemplo
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDismiss(competency.id)}
            >
              <ThumbsDown aria-hidden="true" />
              No me representa
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
