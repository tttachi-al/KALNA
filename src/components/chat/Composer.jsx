import { Check, Mic, MicOff, SendHorizontal, SkipForward } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { OCC_ICONS } from '../ui/icons.js';
import { useSpeechInput } from '../../hooks/useSpeechInput.js';

/**
 * Zona de respuesta del diagnóstico: opciones rápidas, sugerencias,
 * texto libre (con voz si el navegador lo permite) y "omitir".
 */
export function Composer({ ui, disabled, onSend }) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState([]);
  const areaRef = useRef(null);
  const hintId = useId();
  const inputId = useId();
  const speech = useSpeechInput({
    onResult: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)),
  });

  // Reinicia la selección cuando cambia la etapa
  useEffect(() => {
    setSelected([]);
    setText('');
  }, [ui?.stage, ui?.competencyId]);

  // Altura automática del área de texto
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  if (!ui || ui.input === 'none') return null;

  const choiceOnly = ui.input === 'choices';
  const withText = ui.input === 'text' || ui.input === 'choices+text';
  const canSend = !disabled && (text.trim().length > 0 || selected.length > 0);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = (e) => {
    e?.preventDefault();
    if (!canSend) return;
    onSend({ text: text.trim(), choices: selected });
    // Se vacía al enviar (la etapa puede no cambiar, p. ej. en la entrevista).
    // Si el envío falla, «Reintentar» reenvía la misma respuesta.
    setText('');
    setSelected([]);
  };

  return (
    <form className="composer" onSubmit={submit} aria-label="Tu respuesta">
      {ui.choices?.length > 0 && (
        <div
          className="composer-choices"
          role="group"
          aria-label={ui.multi ? 'Elige una o más opciones' : 'Elige una opción'}
        >
          {ui.choices.map((c) => {
            const Icon = c.icon ? OCC_ICONS[c.icon] : null;
            if (ui.multi) {
              const on = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  disabled={disabled}
                >
                  <span className="chip-check" aria-hidden="true">
                    {on && <Check strokeWidth={3} />}
                  </span>
                  {Icon && <Icon aria-hidden="true" />}
                  {c.label}
                </button>
              );
            }
            return (
              <button
                key={c.id}
                type="button"
                className="chip chip-choice"
                onClick={() => onSend({ choices: [c.id] })}
                disabled={disabled}
              >
                {Icon && <Icon aria-hidden="true" />}
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {ui.suggestions?.length > 0 && (
        <div
          className="composer-suggestions"
          role="group"
          aria-label="Sugerencias: toca para agregarlas a tu respuesta"
        >
          <span className="composer-label">Toca las que usabas:</span>
          <div className="chip-group">
            {ui.suggestions.map((s) => {
              const on = selected.includes(s.label);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="chip chip-sm"
                  aria-pressed={on}
                  onClick={() => toggle(s.label)}
                  disabled={disabled}
                >
                  {on && <Check aria-hidden="true" strokeWidth={3} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {withText && (
        <div className="composer-row">
          <label htmlFor={inputId} className="sr-only">
            Escribe tu respuesta
          </label>
          <textarea
            id={inputId}
            ref={areaRef}
            className="textarea composer-input"
            rows={1}
            value={text}
            placeholder={speech.listening ? 'Te escucho…' : ui.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e);
            }}
            disabled={disabled}
            aria-describedby={ui.hint ? hintId : undefined}
            maxLength={1200}
          />
          {speech.supported && (
            <button
              type="button"
              className={`icon-btn composer-mic ${speech.listening ? 'is-listening' : ''}`}
              onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? 'Detener micrófono' : 'Responder con tu voz'}
              aria-pressed={speech.listening}
              disabled={disabled}
            >
              {speech.listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary composer-send"
            disabled={!canSend}
            aria-label={ui.multi ? 'Continuar' : 'Enviar'}
          >
            <SendHorizontal aria-hidden="true" />
            <span>{ui.multi ? 'Continuar' : 'Enviar'}</span>
          </button>
        </div>
      )}

      {choiceOnly && ui.multi && (
        <button type="submit" className="btn btn-primary" disabled={!canSend}>
          Continuar
        </button>
      )}

      <div className="composer-foot">
        {ui.hint && (
          <p id={hintId} className="composer-hint">
            {ui.hint}
          </p>
        )}
        {speech.error && <p className="composer-hint composer-error">{speech.error}</p>}
        {ui.allowSkip && (
          <button
            type="button"
            className="btn btn-ghost btn-sm composer-skip"
            onClick={() => onSend({ skip: true })}
            disabled={disabled}
          >
            <SkipForward aria-hidden="true" />
            {ui.skipLabel}
          </button>
        )}
      </div>
    </form>
  );
}
