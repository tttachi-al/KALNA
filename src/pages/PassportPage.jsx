import { useState } from 'react';
import { ArrowLeft, FileText, Fingerprint, LoaderCircle, Printer, Target } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { kallpaService } from '../services/kallpaService.js';
import { PASSPORT_VERSION } from '../services/engine/passportContent.js';
import { useKallpa } from '../state/useKallpa.js';
import './passport.css';

function Evidence({ sourceIds, passport }) {
  const sources = passport.sources.filter((s) => sourceIds.includes(s.id));
  return <details className="passport-evidence"><summary>Ver el relato que lo respalda</summary>{sources.map((s) => <blockquote key={s.id}>«{s.text}»</blockquote>)}</details>;
}

function Narrative({ title, value, passport, className = '' }) {
  if (!value) return null;
  return <section className={`passport-section ${className}`}><h3>{title}</h3><p>{value.text}</p><Evidence sourceIds={value.sourceIds} passport={passport} /></section>;
}

function Insights({ title, description, items, passport, inferred = false }) {
  if (!items.length) return null;
  return <section className="passport-section"><div><h3>{title}</h3><p className="passport-fine">{description}</p></div>
    <ul className="passport-competency-grid">{items.map((c) => <li key={c.competencyId} className="passport-competency">
      <span className={`passport-status ${inferred ? 'is-reforzar' : 'is-cubierta'}`}>{inferred ? 'Por confirmar' : 'Con evidencia'}</span>
      <h4>{c.name}</h4><p>{c.relevance}</p>
      {c.baseName && <p className="passport-transfer">Competencia de origen: <strong>{c.baseName}</strong></p>}
      <blockquote>«{c.quote}»</blockquote>
      {c.question && <p className="passport-followup"><strong>Para confirmarlo:</strong> {c.question}</p>}
      <Evidence sourceIds={c.sourceIds} passport={passport} />
    </li>)}</ul>
  </section>;
}

export default function PassportPage() {
  const { profile, isDemo, cv } = useKallpa();
  const simulation = isDemo || kallpaService.mode === 'mock';
  const [params] = useSearchParams();
  const location = useLocation();
  const target = params.get('puesto');
  const [message, setMessage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const { data, loading, error } = useAsync(async () => {
    if (simulation || !target || !profile?.profileId) return null;
    return kallpaService.getPassport(profile.profileId, target);
  }, [target, profile?.profileId, simulation]);
  const candidates = simulation ? [profile?.passports?.[target]] : [data, location.state?.passport];
  const passport = candidates.find((p) => p?.occupationId === target && p.version === PASSPORT_VERSION && p.simulation === simulation);
  const canGenerate = !!passport && (!!passport.sources.length || !!cv?.data?.experiences?.some((e) => e.responsibilities?.some(Boolean) || e.achievements?.some(Boolean)) || !!cv?.data?.education?.some((e) => e.qualification));
  const generateWord = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerationError(null);
    setMessage(null);
    try {
      const file = await kallpaService.generateCvWord({ profileId: profile.profileId, occupationId: target, draft: cv?.data,
        ...(simulation ? { mode: 'simulation', profile, passport } : {}),
      });
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('CV en Word generado. Puedes editar los campos pendientes y revisar la redacción antes de enviarlo.');
    } catch (e) { setGenerationError(e.message); }
    finally { setGenerating(false); }
  };
  return <div className="page passport-page">
    <header className="page-header no-print"><div><p className="eyebrow">Pasaporte laboral</p><h1>Tu experiencia tiene valor.</h1><p className="lead">Descubre qué puedes aportar al puesto que elegiste y cómo comunicarlo con ejemplos.</p></div>
      <Link to="/ocupaciones" className="btn"><ArrowLeft aria-hidden="true" /> Volver a puestos</Link>
    </header>
    {!passport && (loading && target ? <p role="status">Recuperando tu pasaporte…</p> : <p>Selecciona un puesto en «Puestos recomendados para postular» y pulsa «Pasaporte para este puesto» para generar o actualizar tu pasaporte.</p>)}
    {error && <p role="alert">{error.message}</p>}
    {message && <p role="status">{message}</p>}
    {generationError && <p role="alert">{generationError}</p>}
    {passport && <article className="passport" aria-label={`Pasaporte para ${passport.target.name}`}>
      <header className="passport-band"><div className="passport-heading"><span className="passport-emblem"><Fingerprint aria-hidden="true" /></span><div><p className="passport-kicker">KALNA · PASAPORTE LABORAL</p><h2>{profile?.alias || 'Tu pasaporte'}</h2><p className="passport-destination"><Target aria-hidden="true" />{passport.target.name}</p></div></div><span className="passport-document-tag">Documento no oficial</span></header>
      {passport.simulation && <p className="notice notice-fiction">Simulación · Análisis con reglas locales, sin QVAC.{isDemo && ' Perfil ficticio de ejemplo.'}</p>}
      {passport.target.synthetic && <p className="passport-fine">Puesto de referencia sintético; no es una oferta publicada.</p>}
      <Narrative title="Mi perfil para este puesto" value={passport.presentation} passport={passport} />
      <Insights title="Fortalezas demostrables" description="Competencias respaldadas por ejemplos que ya aportaste." items={passport.strengths} passport={passport} />
      <Insights title="Competencias transferibles" description="Experiencias aprovechables en este puesto. La transferencia es una posibilidad, no una competencia acreditada." items={passport.transferable} passport={passport} inferred />
      <Insights title="Lo que quizá no habías identificado" description="Estas competencias son inferidas de tus relatos y necesitan tu confirmación. No se añaden automáticamente a tu perfil." items={passport.inferred} passport={passport} inferred />
      <Narrative title="Mi valor diferencial" value={passport.differential} passport={passport} />
      <Narrative title="Cómo presentar mi experiencia" value={passport.pitch} passport={passport} className="passport-pitch" />
      {!!passport.questions.length && <section className="passport-section passport-questions"><h3>Para conocer mejor tu experiencia</h3><p className="passport-fine">Responde con un ejemplo real. Después puedes volver al puesto y actualizar el pasaporte.</p><ul>{passport.questions.map((q) => <li key={q.competencyId}><p>{q.text}</p><Link to={`/perfil?c=${q.competencyId}`} className="btn btn-sm no-print">Aportar un ejemplo</Link></li>)}</ul></section>}
      {!passport.strengths.length && <p className="notice">Todavía no hay ejemplos suficientes para redactar una presentación profesional respaldada. Las preguntas anteriores ayudarán a completar esa información.</p>}
      <footer className="passport-footer"><p>Este documento reúne experiencias declaradas e inferencias identificadas como tales. No certifica competencias ni garantiza la contratación.</p><div className="passport-toolbar no-print">
        <button type="button" className="btn btn-primary" disabled={generating || !canGenerate} aria-busy={generating} onClick={generateWord}>{generating ? <LoaderCircle className="btn-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}{generating ? 'Redactando y preparando tu CV…' : 'Generar CV en Word'}</button>
        <button type="button" className="btn" onClick={() => window.print()}><Printer aria-hidden="true" /> Imprimir pasaporte</button>
      </div><p className="passport-fine">{!canGenerate ? 'Añade un ejemplo de experiencia en tu perfil para comenzar. ' : ''}El Word incluirá tu experiencia y campos editables para completar los datos que falten directamente en el documento.</p></footer>
    </article>}
  </div>;
}
