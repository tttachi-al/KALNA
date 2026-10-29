import { ChevronDown, RotateCcw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage, TypingIndicator } from '../components/chat/ChatMessage.jsx';
import { Composer } from '../components/chat/Composer.jsx';
import { FindingsPanel } from '../components/chat/FindingsPanel.jsx';
import { SkillPop } from '../components/chat/GameBits.jsx';
import { StepProgress } from '../components/chat/StepProgress.jsx';
import { ConfirmDialog } from '../components/ui/Dialog.jsx';
import { InfoNotice } from '../components/ui/Notice.jsx';
import { CHAT_MESSAGE_MS, DEMO_STEPS } from '../data/demoSteps.js';
import { useDemoAnchor } from '../hooks/useDemoAnchor.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useSkillGame } from '../hooks/useSkillGame.js';
import { kallpaService } from '../services/kallpaService.js';
import { useKallpa } from '../state/useKallpa.js';
import './diagnosis.css';

const REVEAL_MS = 650;

/** Reconstruye el estado de las competencias a partir de los mensajes visibles (modo demostración). */
function findingsFromMessages(messages) {
  const map = new Map();
  for (const m of messages) {
    if (m.kind === 'findings') {
      for (const id of m.data.ids) if (!map.has(id)) map.set(id, m.data.source === 'herramientas' ? 'por_validar' : 'declarada');
    }
    if (m.kind === 'reinforce' || m.kind === 'evidence-partial') {
      const ids = m.data?.ids || [m.data?.competencyId];
      for (const id of ids) if (map.get(id) === 'por_validar' && m.data?.source !== 'herramientas') map.set(id, 'declarada');
    }
    if (m.kind === 'evidence-ok') map.set(m.data.competencyId, 'evidencia');
  }
  return [...map.entries()].map(([id, status]) => ({ id, status }));
}

function labelForInput(ui, input) {
  if (input.skip) return ui.skipLabel;
  const parts = [];
  if (input.choices?.length) {
    const labels = input.choices.map((c) => ui.choices.find((x) => x.id === c)?.label || c);
    parts.push(labels.join(', '));
  }
  if (input.text) parts.unshift(input.text);
  return parts.join('. ');
}

export default function DiagnosisPage() {
  const { state, dispatch, isDemo, profile } = useKallpa();
  const reduced = useReducedMotion();
  const listRef = useRef(null);
  const starting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  // Resultado real del guardado del perfil en el servidor (solo cuando se intentó).
  const [saveError, setSaveError] = useState(null);
  const [lastInput, setLastInput] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const chatRef = useRef(null);
  useDemoAnchor({ relato: chatRef, evidencias: chatRef });

  /* ───────── Mensajes: persona o demostración ───────── */
  const demo = state.demo;
  const demoStep = DEMO_STEPS[demo.step];
  const demoRange = useMemo(() => {
    if (!isDemo || !demo.data) return null;
    const cp = demo.data.checkpoints;
    const relatoIndex = DEMO_STEPS.findIndex((s) => s.id === 'relato');
    if (demoStep?.chat) return { start: cp[demoStep.chat.from], end: cp[demoStep.chat.to] ?? demo.data.transcript.length };
    if (demo.step < relatoIndex) return { start: cp.relato, end: cp.relato };
    return { start: demo.data.transcript.length, end: demo.data.transcript.length };
  }, [isDemo, demo.data, demo.step, demoStep]);

  const allMessages = useMemo(
    () => (isDemo ? demo.data?.transcript || [] : state.diagnosis?.session?.messages || []),
    [isDemo, demo.data, state.diagnosis],
  );
  const ui = isDemo ? null : state.diagnosis?.ui;
  const total = allMessages.length;

  const [visible, setVisible] = useState(() => (isDemo ? demoRange?.start ?? 0 : total));

  // Demostración: al cambiar de paso, mostrar desde el punto de partida
  useEffect(() => {
    if (demoRange) setVisible(reduced ? demoRange.end : demoRange.start);
  }, [demoRange, reduced]);

  // Revelado progresivo de mensajes
  const limit = isDemo ? demoRange?.end ?? total : total;
  const canAdvance = !isDemo || demo.playing;
  useEffect(() => {
    if (visible >= limit || !canAdvance) return undefined;
    const t = setTimeout(() => setVisible((v) => v + 1), reduced ? 0 : isDemo ? CHAT_MESSAGE_MS : REVEAL_MS);
    return () => clearTimeout(t);
  }, [visible, limit, canAdvance, reduced, isDemo]);

  const shown = allMessages.slice(0, Math.min(visible, limit));
  const revealing = visible < limit;

  // Desplazar al último mensaje
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [shown.length, pending, reduced]);

  /* ───────── Inicio de la conversación ───────── */
  const start = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await kallpaService.startDiagnosis();
      setVisible(0);
      dispatch({ type: 'diagnosis/set', session: r.session, ui: r.ui });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      starting.current = false;
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isDemo && !state.diagnosis) start();
  }, [isDemo, state.diagnosis, start]);

  /* ───────── Enviar respuesta ───────── */
  const send = async (input) => {
    if (!state.diagnosis || busy) return;
    setLastInput(input);
    setPending(labelForInput(ui, input));
    setBusy(true);
    setError(null);
    const sessionIn = { ...state.diagnosis.session, profile: state.profile };
    try {
      const r = await kallpaService.sendDiagnosisAnswer(sessionIn, input);
      if (r.persistence) setSaveError(r.persistence.saved ? null : r.persistence.error);
      setVisible(sessionIn.messages.length + 1);
      dispatch({ type: 'diagnosis/set', session: r.session, ui: r.ui });
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const restart = () => {
    setConfirm(false);
    dispatch({ type: 'diagnosis/reset' });
  };

  /* ───────── Competencias en vivo ───────── */
  const liveItems = useMemo(() => {
    if (isDemo && shown.length < allMessages.length) return findingsFromMessages(shown);
    return Object.values(profile?.competencies || {}).map((c) => ({ id: c.id, status: c.status }));
  }, [isDemo, shown, allMessages.length, profile]);
  const gameEvent = useSkillGame(liveItems, busy || (!isDemo && revealing));
  const statusOf = (id) => liveItems.find((i) => i.id === id)?.status || 'declarada';

  const progress = isDemo ? demo.data?.ui?.progress && progressForDemo(demo.data, shown.length) : ui?.progress;
  const lastIsResult = shown.at(-1)?.kind === 'result';
  const actions = isDemo ? demo.data?.ui?.actions : ui?.actions;

  return (
    <div className="page diagnosis">
      <header className="page-header">
        <div>
          <p className="eyebrow">Paso 1 · Diagnóstico conversado</p>
          <h1>Cuéntame sobre tu trabajo</h1>
        </div>
        {!isDemo && state.diagnosis?.session?.stage !== 'bienvenida' && (
          <button type="button" className="btn" onClick={() => setConfirm(true)}>
            <RotateCcw aria-hidden="true" />
            Empezar de nuevo
          </button>
        )}
      </header>

      <StepProgress progress={progress} />

      <details className="findings-mobile disclosure">
        <summary>
          Lo que voy reconociendo
          <span className="badge badge-neutral">{liveItems.length}</span>
          <ChevronDown className="chev" aria-hidden="true" />
        </summary>
        <div className="disclosure-body">
          <FindingsPanel items={liveItems} compact highlight={gameEvent?.id} />
        </div>
      </details>

      <div className="diag-layout">
        <section className="chat card" aria-label="Conversación con Kalna" ref={chatRef} data-demo-anchor>
          {gameEvent && <SkillPop key={`${gameEvent.id}-${gameEvent.type}`} event={gameEvent} />}
          <ol className="chat-list" ref={listRef} aria-live="polite" aria-relevant="additions">
            {shown.map((m, i) => (
              <ChatMessage
                key={m.id}
                message={m}
                statusOf={statusOf}
                actions={i === shown.length - 1 && lastIsResult && !revealing ? actions : null}
                onRestart={restart}
              />
            ))}
            {pending && (
              <li className="msg msg-user">
                <span className="sr-only">Tú dijiste: </span>
                <p>{pending}</p>
              </li>
            )}
            {(busy || (revealing && canAdvance)) && <TypingIndicator />}
          </ol>

          {error && (
            <div className="chat-error" role="alert">
              <TriangleAlert aria-hidden="true" />
              <span className="spacer">{error}</span>
              <button type="button" className="btn btn-sm" onClick={() => (state.diagnosis ? send(lastInput) : start())}>
                Reintentar
              </button>
            </div>
          )}

          {saveError && !isDemo && (
            <InfoNotice icon={TriangleAlert} tone="fiction">
              <strong>Tu perfil no se guardó en el servidor.</strong> {saveError} Lo que ves sigue
              disponible en este navegador.
            </InfoNotice>
          )}

          {isDemo ? (
            <div className="chat-demo-note">
              <InfoNotice>En el modo demostración, las respuestas de María (ficticia) se escriben solas.</InfoNotice>
              {revealing && !demo.playing && (
                <button type="button" className="btn btn-sm" onClick={() => setVisible(limit)}>
                  Mostrar toda la conversación
                </button>
              )}
            </div>
          ) : (
            <Composer ui={ui} disabled={busy || revealing} onSend={send} />
          )}
        </section>

        <aside className="findings-aside card" aria-label="Competencias reconocidas">
          <FindingsPanel items={liveItems} highlight={gameEvent?.id} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        title="¿Empezar el diagnóstico de nuevo?"
        confirmLabel="Sí, empezar de nuevo"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={restart}
      >
        Se borrarán la conversación y las competencias reconocidas hasta ahora.
      </ConfirmDialog>
    </div>
  );
}

/** Progreso aproximado de la demostración según los mensajes visibles. */
function progressForDemo(data, count) {
  const base = data.ui.progress;
  const cp = data.checkpoints;
  let current = 0;
  if (count >= cp.fin) current = base.total;
  else if (count > cp.evidencias) current = base.total - 1;
  else if (count > cp.relato) {
    const span = cp.evidencias - cp.relato;
    current = 1 + Math.min(3, Math.floor(((count - cp.relato) / span) * 4));
  }
  return { ...base, current };
}
