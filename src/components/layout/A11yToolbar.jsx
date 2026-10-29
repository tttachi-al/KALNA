import {
  AArrowDown,
  AArrowUp,
  Accessibility,
  CirclePause,
  Contrast,
  RotateCcw,
  Square,
  UnfoldVertical,
  Underline,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import './a11y.css';

const KEY = 'kallpa-a11y';
const DEFAULTS = { scale: 0, contrast: false, spacing: false, links: false, motion: false };
const MIN_SCALE = -1;
const MAX_SCALE = 3;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

/** Refleja las preferencias en <html> para que el CSS las aplique en toda la app. */
function apply(prefs) {
  const root = document.documentElement;
  root.style.fontSize = prefs.scale ? `${100 + prefs.scale * 12.5}%` : '';
  const flags = { contrast: 'high', spacing: 'wide', links: 'underline', motion: 'reduce' };
  Object.entries(flags).forEach(([k, v]) => {
    if (prefs[k]) root.setAttribute(`data-a11y-${k}`, v);
    else root.removeAttribute(`data-a11y-${k}`);
  });
}

/** Texto para leer en voz alta: lo seleccionado o, si no hay selección, el contenido principal. */
function textToRead() {
  const selected = window.getSelection()?.toString().trim();
  if (selected) return selected;
  return document.getElementById('contenido')?.innerText.trim() || '';
}

/**
 * Herramientas de accesibilidad: botón flotante que despliega ajustes de lectura
 * (tamaño de texto, contraste, espaciado, enlaces, animaciones y lectura en voz alta).
 */
export function A11yToolbar() {
  const [prefs, setPrefs] = useState(load);
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const panelId = useId();
  const ref = useRef(null);

  useEffect(() => {
    apply(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* el almacenamiento puede no estar disponible */
    }
  }, [prefs]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [open]);

  useEffect(() => () => canSpeak && window.speechSynthesis.cancel(), []);

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const speak = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = textToRead();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-PE';
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('es'));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  const reset = () => {
    if (canSpeak) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPrefs(DEFAULTS);
  };

  const pct = 100 + prefs.scale * 12.5;
  const changed = JSON.stringify(prefs) !== JSON.stringify(DEFAULTS);

  const tools = [
    {
      id: 'up',
      Icon: AArrowUp,
      label: 'Aumentar texto',
      onClick: () => set({ scale: Math.min(MAX_SCALE, prefs.scale + 1) }),
      disabled: prefs.scale >= MAX_SCALE,
    },
    {
      id: 'down',
      Icon: AArrowDown,
      label: 'Reducir texto',
      onClick: () => set({ scale: Math.max(MIN_SCALE, prefs.scale - 1) }),
      disabled: prefs.scale <= MIN_SCALE,
    },
    { id: 'contrast', Icon: Contrast, label: 'Alto contraste', pressed: prefs.contrast },
    {
      id: 'spacing',
      Icon: UnfoldVertical,
      label: 'Más espacio entre líneas',
      pressed: prefs.spacing,
    },
    { id: 'links', Icon: Underline, label: 'Subrayar enlaces', pressed: prefs.links },
    { id: 'motion', Icon: CirclePause, label: 'Detener animaciones', pressed: prefs.motion },
    ...(canSpeak
      ? [
          {
            id: 'speak',
            Icon: speaking ? Square : Volume2,
            label: speaking ? 'Detener lectura' : 'Leer en voz alta',
            onClick: speak,
            pressed: speaking,
          },
        ]
      : []),
  ];

  return (
    <div className={`a11y ${open ? 'is-open' : ''}`} ref={ref}>
      {open && (
        <div
          className="a11y-panel"
          id={panelId}
          role="group"
          aria-label="Herramientas de accesibilidad"
        >
          <div className="a11y-head">
            <strong>Accesibilidad</strong>
            <span className="a11y-scale" aria-live="polite">
              Texto al {pct}%
            </span>
          </div>
          <ul className="a11y-list" role="list">
            {tools.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="a11y-tool"
                  onClick={t.onClick || (() => toggle(t.id))}
                  disabled={t.disabled}
                  aria-pressed={t.pressed}
                >
                  <span className="a11y-ico">
                    <t.Icon aria-hidden="true" />
                  </span>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="a11y-reset"
            onClick={reset}
            disabled={!changed && !speaking}
          >
            <RotateCcw aria-hidden="true" />
            Restablecer
          </button>
        </div>
      )}
      <button
        type="button"
        className="a11y-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          open ? 'Cerrar herramientas de accesibilidad' : 'Abrir herramientas de accesibilidad'
        }
        title="Accesibilidad"
      >
        {open ? <X aria-hidden="true" /> : <Accessibility aria-hidden="true" />}
        {changed && !open && <span className="a11y-dot" aria-hidden="true" />}
      </button>
    </div>
  );
}
