import { ArrowLeft, ArrowRight, Award, BadgeCheck, CircleAlert, ClipboardCheck, Download, LoaderCircle, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink.jsx';
import { EmptyProfile } from '../components/ui/EmptyState.jsx';
import { COMPETENCIES } from '../data/competencies.js';
import { QUESTIONS_PER_COMPETENCY, RESULT_LABELS, evidenceCompetencyIds, summarizeAssessment } from '../services/engine/assessment.js';
import { hasProfile } from '../services/engine/profile.js';
import { kallpaService } from '../services/kallpaService.js';
import { useKallpa } from '../state/useKallpa.js';
import './assessment.css';

const STORAGE_KEY = 'kallpa:evaluacion';
const POLL_MS = 2500;
const MAX_POLL_FAILURES = 3;

const readSaved = () => {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
};
const writeSaved = (value) => {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* almacenamiento no disponible: el intento sigue en memoria */ }
};

function saveFile({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pantalla inicial: competencias con evidencia, criterio de aprobación y botón para empezar. */
function Intro({ available, selected, setSelected, onStart, starting, error }) {
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <section className="card stack assess-intro" aria-labelledby="assess-intro-title">
      <h2 id="assess-intro-title" className="card-title">Cómo funciona</h2>
      <ul className="assess-rules text-sm">
        <li>Responderás <strong>{QUESTIONS_PER_COMPETENCY} situaciones laborales por cada competencia</strong>, con cinco alternativas cada una.</li>
        <li><strong>Criterio de aprobación:</strong> una competencia se aprueba en esta evaluación solo si respondes correctamente sus dos preguntas. Con una sola respuesta correcta, queda por reforzar.</li>
        <li>Por cada competencia aprobada podrás obtener una constancia de Kalna en PDF. Es un documento informativo, no una certificación oficial.</li>
        <li>Las preguntas se preparan con QVAC a partir de tus ejemplos y se verifican antes de mostrarse. Si QVAC no está disponible, se usan preguntas del banco validado de Kalna. Prepararlas puede tardar unos minutos.</li>
      </ul>
      <fieldset className="assess-pick">
        <legend className="field-label">Competencias con evidencia que se evaluarán</legend>
        {available.map((id) => (
          <label key={id} className="assess-check">
            <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
            <span>{COMPETENCIES[id].name}</span>
          </label>
        ))}
        <p className="field-help">
          {selected.length} {selected.length === 1 ? 'competencia' : 'competencias'} · {selected.length * QUESTIONS_PER_COMPETENCY} preguntas
        </p>
      </fieldset>
      {error && <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></p>}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onStart} disabled={!selected.length || starting} aria-busy={starting}>
          {starting ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
          {starting ? 'Iniciando…' : 'Comenzar evaluación'}
        </button>
      </div>
    </section>
  );
}

function Preparing({ attempt, pollError, onRetry }) {
  const { done, total, current } = attempt.progress;
  return (
    <section className="card stack" aria-live="polite">
      <div className="loading-notice">
        <LoaderCircle className="loading-spin" aria-hidden="true" />
        <div>
          <p className="loading-title">Preparando tus preguntas…</p>
          <p className="muted text-sm">{current ? `Redactando y verificando situaciones de «${current}».` : 'Iniciando.'} Competencias listas: {done} de {total}.</p>
        </div>
      </div>
      <div className="progress" role="progressbar" aria-label="Preparación de la evaluación" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      {pollError && (
        <p className="notice notice-fiction" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{pollError} <button type="button" className="btn btn-sm" onClick={onRetry}>Volver a consultar</button></span>
        </p>
      )}
    </section>
  );
}

function Question({ attempt, index, answers, onAnswer, onPrev, onNext }) {
  const item = attempt.items[index];
  const total = attempt.items.length;
  const selected = answers[item.id];
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, [index]);
  return (
    <section className="card stack assess-question" aria-labelledby="assess-q-title">
      <div className="assess-q-head">
        <p className="eyebrow" id="assess-q-title" tabIndex={-1} ref={headingRef}>Pregunta {index + 1} de {total}</p>
        <span className="badge badge-brand">{item.competencyName}</span>
      </div>
      <p className="field-help assess-source">{item.source === 'qvac' ? 'Situación generada con QVAC a partir de tus ejemplos y verificada automáticamente.' : 'Situación del banco validado de Kalna.'}</p>
      <div className="progress" role="progressbar" aria-label="Avance de la evaluación" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1}>
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <fieldset className="assess-options">
        <legend className="assess-situation">{item.situation}</legend>
        {item.options.map((o, n) => (
          <label key={o.id} className={`assess-option ${selected === o.id ? 'is-selected' : ''}`}>
            <input type="radio" name={`q-${item.id}`} value={o.id} checked={selected === o.id} onChange={() => onAnswer(item.id, o.id)} />
            <span className="assess-letter" aria-hidden="true">{String.fromCharCode(65 + n)}</span>
            <span>{o.text}</span>
          </label>
        ))}
      </fieldset>
      {!selected && <p className="field-help">Selecciona una alternativa para continuar.</p>}
      <div className="row assess-nav">
        <button type="button" className="btn" onClick={onPrev} disabled={index === 0}><ArrowLeft aria-hidden="true" /> Anterior</button>
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={!selected}>
          {index === total - 1 ? 'Revisar respuestas' : 'Siguiente'} <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function Review({ attempt, answers, onEdit, onSubmit, submitting, error }) {
  const pending = attempt.items.filter((i) => !answers[i.id]).length;
  return (
    <section className="card stack" aria-labelledby="assess-review-title">
      <h2 id="assess-review-title" className="card-title">Revisa tus respuestas</h2>
      <p className="muted text-sm">Puedes cambiar cualquier respuesta antes de enviarla. Las respuestas correctas se muestran después de enviar.</p>
      <ol className="assess-review">
        {attempt.items.map((item, i) => {
          const option = item.options.find((o) => o.id === answers[item.id]);
          return (
            <li key={item.id}>
              <p className="text-sm muted">{item.competencyName}</p>
              <p className="assess-review-situation">{item.situation}</p>
              <p className="text-sm"><strong>Tu respuesta:</strong> {option ? option.text : 'Sin responder'}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(i)}>Cambiar respuesta</button>
            </li>
          );
        })}
      </ol>
      {error && <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></p>}
      <div className="row">
        <button type="button" className="btn" onClick={() => onEdit(attempt.items.length - 1)}><ArrowLeft aria-hidden="true" /> Volver a las preguntas</button>
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={pending > 0 || submitting} aria-busy={submitting}>
          {submitting ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}
          {submitting ? 'Corrigiendo…' : 'Enviar respuestas'}
        </button>
      </div>
      {pending > 0 && <p className="field-help">Faltan {pending} respuestas.</p>}
    </section>
  );
}

/** Botón de descarga con su propio estado de carga y error (permite reintentar). */
function CertificateButton({ label, onDownload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try { await onDownload(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="assess-cert">
      <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        {busy ? 'Generando constancia…' : label}
      </button>
      {error && <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>{error} Puedes volver a intentarlo.</span></p>}
    </div>
  );
}

function Results({ attempt, onRestart }) {
  const { results } = attempt;
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  // La interfaz recalcula el resumen con la misma regla y lo compara con el del backend.
  const check = useMemo(() => summarizeAssessment(results.items), [results.items]);
  const consistent = check.approvedCount === results.approvedCount && check.correct === results.correct && check.competencies.every((c) => results.competencies.some((r) => r.competencyId === c.competencyId && r.approved === c.approved));
  const optionText = (item, id) => attempt.items.find((i) => i.id === item.itemId)?.options.find((o) => o.id === id)?.text || '—';
  const situation = (item) => attempt.items.find((i) => i.id === item.itemId)?.situation;
  const download = (competencyId) => async () => {
    const trimmed = name.trim();
    if (trimmed && !confirmed) throw new Error('Marca la casilla para confirmar tu nombre, o déjalo en blanco.');
    saveFile(await kallpaService.downloadAssessmentCertificate(attempt.id, { competencyId, participantName: trimmed || null, participantNameConfirmed: Boolean(trimmed) && confirmed }));
  };

  if (!consistent) {
    return <p className="notice notice-fiction" role="alert"><CircleAlert aria-hidden="true" /><span>Los resultados recibidos no son coherentes. No se muestran constancias. Vuelve a cargar la página o inicia una nueva evaluación.</span></p>;
  }
  return (
    <div className="stack">
      <section className="card assess-summary" aria-labelledby="assess-sum-title">
        <h2 id="assess-sum-title" className="card-title">Resultados de tu evaluación</h2>
        <div className="stat-grid">
          <div className="stat"><span className="stat-value">{results.approvedCount} de {results.evaluatedCount}</span><span className="stat-label">competencias aprobadas</span></div>
          <div className="stat"><span className="stat-value">{results.correct} de {results.total}</span><span className="stat-label">respuestas alineadas ({results.total ? Math.round((results.correct / results.total) * 100) : 0} %)</span></div>
        </div>
        <p className="muted text-sm">Cada resultado describe tu desempeño en estas situaciones; no mide por sí solo el dominio completo de una habilidad.</p>
      </section>

      {results.approvedCount > 0 && (
        <section className="card stack-sm" aria-labelledby="assess-name-title">
          <h2 id="assess-name-title" className="card-title">Datos para tu constancia</h2>
          <label className="field-label" htmlFor="assess-name">Nombre del participante (opcional)</label>
          <input id="assess-name" className="input" value={name} maxLength={80} autoComplete="name" onChange={(e) => { setName(e.target.value); setConfirmed(false); }} placeholder="Como quieres que aparezca en la constancia" />
          {name.trim() && (
            <label className="assess-check">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>Confirmo que este es mi nombre.</span>
            </label>
          )}
          <p className="field-help">Si lo dejas en blanco, la constancia dirá «No indicado». El nombre no se guarda en Kalna.</p>
        </section>
      )}

      {results.competencies.map((c) => {
        const items = results.items.filter((i) => i.competencyId === c.competencyId);
        return (
          <section key={c.competencyId} className={`card stack-sm assess-result ${c.approved ? 'is-approved' : ''}`} aria-labelledby={`r-${c.competencyId}`}>
            <div className="assess-q-head">
              <h3 id={`r-${c.competencyId}`} className="card-title">{c.name}</h3>
              <span className={`badge ${c.approved ? 'badge-evidencia' : 'badge-por_validar'}`}>{c.approved ? RESULT_LABELS.approved : RESULT_LABELS.notApproved}</span>
            </div>
            <p className="text-sm">{c.correct} de {c.total} respuestas correctas.{!c.approved && ' Para aprobar esta competencia se necesitan las dos.'}</p>
            <ol className="assess-feedback">
              {items.map((item) => (
                <li key={item.itemId}>
                  <p className="assess-review-situation">{situation(item)}</p>
                  <p className={`text-sm ${item.correct ? 'assess-ok' : 'assess-miss'}`}>
                    <strong>{item.correct ? RESULT_LABELS.correct : RESULT_LABELS.incorrect}.</strong> Elegiste: {optionText(item, item.selected)}
                  </p>
                  {!item.correct && <p className="text-sm"><strong>Respuesta más adecuada:</strong> {optionText(item, item.correctOption)}</p>}
                  <p className="text-sm muted">{item.explanation}</p>
                </li>
              ))}
            </ol>
            {c.approved && <CertificateButton label="Obtener constancia" onDownload={download(c.competencyId)} />}
          </section>
        );
      })}

      {attempt.gaps.length > 0 && (
        <section className="card">
          <h2 className="card-title">Competencias que no se pudieron evaluar</h2>
          <ul className="text-sm">{attempt.gaps.map((g) => <li key={g.competencyId}><strong>{g.name}:</strong> {g.reason}</li>)}</ul>
        </section>
      )}

      <div className="row">
        {results.approvedCount > 1 && <CertificateButton label="Obtener constancia consolidada" onDownload={download(null)} />}
        <button type="button" className="btn" onClick={onRestart}><RotateCcw aria-hidden="true" /> Nueva evaluación</button>
      </div>
    </div>
  );
}

export default function AssessmentPage() {
  const { profile, isDemo } = useKallpa();
  const available = useMemo(() => (hasProfile(profile) ? evidenceCompetencyIds(profile).filter((id) => COMPETENCIES[id]) : []), [profile]);
  const [selected, setSelected] = useState(available);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('intro');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pollError, setPollError] = useState(null);
  const failures = useRef(0);
  const attemptId = attempt?.id;

  const show = useCallback((a, saved = {}) => {
    setAttempt(a);
    if (a.status === 'preparando') setPhase('preparing');
    else if (a.status === 'lista') { setAnswers(saved.answers || {}); setIndex(Math.min(saved.index || 0, a.items.length - 1)); setPhase(saved.review ? 'review' : 'answering'); }
    else if (a.status === 'completada') setPhase('results');
    else { setError(a.error || 'La evaluación no se pudo preparar.'); setPhase('intro'); writeSaved(null); }
  }, []);

  // Retoma un intento de esta pestaña (por ejemplo, tras recargar la página).
  useEffect(() => {
    const saved = readSaved();
    if (!saved?.id) return;
    kallpaService.getAssessment(saved.id).then((a) => show(a, saved)).catch(() => writeSaved(null));
  }, [show]);

  useEffect(() => {
    if (attempt && ['lista', 'preparando'].includes(attempt.status)) writeSaved({ id: attempt.id, answers, index, review: phase === 'review' });
    if (attempt?.status === 'completada') writeSaved({ id: attempt.id });
  }, [attempt, answers, index, phase]);

  const poll = useCallback(async () => {
    try {
      const a = await kallpaService.getAssessment(attemptId);
      failures.current = 0;
      setPollError(null);
      if (a.status !== 'preparando') show(a);
      else setAttempt(a);
    } catch (e) {
      failures.current += 1;
      if (failures.current >= MAX_POLL_FAILURES) setPollError(`No se pudo consultar el avance: ${e.message}`);
      else setAttempt((a) => ({ ...a }));
    }
  }, [attemptId, show]);

  useEffect(() => {
    if (phase !== 'preparing' || pollError) return undefined;
    const timer = setTimeout(poll, POLL_MS);
    return () => clearTimeout(timer);
  }, [phase, attempt, poll, pollError]);

  if (!hasProfile(profile)) {
    return <div className="page"><BackLink to="/perfil" label="Perfil" /><EmptyProfile /></div>;
  }

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = profile.profileId && !isDemo ? { profileId: profile.profileId, competencyIds: selected } : { profile, competencyIds: selected };
      show(await kallpaService.startAssessment(body));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try { show(await kallpaService.submitAssessment(attempt.id, answers)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const restart = () => { writeSaved(null); setAttempt(null); setAnswers({}); setIndex(0); setError(null); setPollError(null); setPhase('intro'); };

  return (
    <div className="page assessment">
      <BackLink to="/perfil" label="Perfil" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Evaluación de competencias</p>
          <h1>Validar competencias</h1>
          <p className="lead">Responde situaciones laborales sobre tus competencias con evidencia{attempt?.context ? ` · ${attempt.context}` : ''}.</p>
        </div>
      </header>
      {isDemo && <p className="notice notice-fiction">Perfil ficticio de demostración: la constancia lo indicará.</p>}
      {attempt && attempt.persistent === false && <p className="notice notice-info text-sm">El servidor no tiene base de datos: esta evaluación se conserva temporalmente (hasta 24 horas o hasta que el servidor se reinicie).</p>}

      {phase === 'intro' && (available.length ? (
        <Intro available={available} selected={selected} setSelected={setSelected} onStart={start} starting={busy} error={error} />
      ) : (
        <section className="card stack-sm">
          <p>Todavía no tienes competencias con evidencia. Agrega un ejemplo concreto a una competencia de tu perfil para poder evaluarla.</p>
          <Link to="/perfil" className="btn"><ArrowLeft aria-hidden="true" /> Ir a mi perfil</Link>
        </section>
      ))}
      {phase === 'preparing' && attempt && <Preparing attempt={attempt} pollError={pollError} onRetry={() => { failures.current = 0; setPollError(null); }} />}
      {phase === 'answering' && attempt && (
        <>
          {attempt.gaps.length > 0 && <p className="notice notice-info text-sm">No se evaluarán: {attempt.gaps.map((g) => g.name).join(', ')}. No se pudieron preparar dos preguntas validadas.</p>}
          <Question attempt={attempt} index={index} answers={answers} onAnswer={(id, option) => setAnswers((a) => ({ ...a, [id]: option }))}
            onPrev={() => setIndex((i) => Math.max(0, i - 1))} onNext={() => (index === attempt.items.length - 1 ? setPhase('review') : setIndex((i) => i + 1))} />
        </>
      )}
      {phase === 'review' && attempt && <Review attempt={attempt} answers={answers} onEdit={(i) => { setIndex(i); setPhase('answering'); }} onSubmit={submit} submitting={busy} error={error} />}
      {phase === 'results' && attempt?.results && <Results attempt={attempt} onRestart={restart} />}
      {phase === 'results' && attempt?.results?.approvedCount === 0 && (
        <p className="notice notice-brand text-sm"><Award aria-hidden="true" /><span>En este intento no se aprobó ninguna competencia, así que no corresponde una constancia de aprobación. Revisa la retroalimentación y vuelve a intentarlo cuando quieras.</span></p>
      )}
    </div>
  );
}
