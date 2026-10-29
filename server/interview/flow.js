import {
  advance,
  describeStage,
  registerFindings,
  startEvidenceOrEmpty,
  startSession,
  withMessages,
} from '../../src/services/engine/diagnosisFlow.js';
import { COMPETENCIES } from '../../src/data/competencies.js';
import { joinNames, splitFragments, uid } from '../../src/services/engine/text.js';
import { runCompetencyAnalysis } from '../competencies/analyze.js';
import { applyAnalysis } from '../competencies/merge.js';
import { createInterviewState, redact, userTextsOf } from './state.js';
import { runInterviewTurn } from './turn.js';

/**
 * Diagnóstico con entrevista adaptativa (modo `qvac`).
 *
 * Reutiliza la máquina de etapas del motor para la bienvenida y los datos
 * básicos (nombre → ocupaciones → formalidad → tiempo) y, en lugar de las
 * preguntas fijas (tareas → herramientas → responsabilidades → situaciones),
 * abre la etapa `entrevista`, donde QVAC decide cada pregunta. Al terminar,
 * se identifican las competencias con QVAC (una sola vez, ver
 * server/competencies/) y sigue la etapa de ejemplos y el cierre del motor.
 *
 * Mismo contrato que el motor: { session, messages, ui }.
 */
const bot = (text, kind = 'text', data) => ({ id: uid('m'), role: 'bot', text, kind, data, at: Date.now() });
const user = (text) => ({ id: uid('m'), role: 'user', text, kind: 'text', at: Date.now() });

const STEPS = [
  { id: 'experiencia', label: 'Tu experiencia' },
  { id: 'historia', label: 'Tu historia' },
  { id: 'evidencia', label: 'Ejemplos' },
];
const STEP_OF = { nombre: 0, ocupaciones: 0, formalidad: 0, tiempo: 0, entrevista: 1, evidencia: 2 };

export function describeAdaptiveStage(session) {
  const base = describeStage(session);
  const progress = {
    steps: STEPS,
    current: session.stage === 'fin' ? STEPS.length : STEP_OF[session.stage] ?? 0,
    total: STEPS.length,
    started: session.stage !== 'bienvenida',
  };
  if (session.stage !== 'entrevista') return { ...base, progress };
  return {
    ...base,
    progress,
    input: 'text',
    allowSkip: (session.interview?.turns || 0) >= 2,
    skipLabel: 'Prefiero terminar aquí',
    placeholder: 'Escribe con tus palabras…',
    hint: 'Puedes escribir o usar el micrófono. No hay respuestas buenas ni malas.',
  };
}

const pack = ({ session, messages }) => ({ session, messages, ui: describeAdaptiveStage(session) });

const CLOSING = 'Gracias por contarme tu experiencia. Con lo que me dijiste ya tengo una buena idea de tu trabajo.';

function questionMessage({ question, origin }, model) {
  return bot(question.texto, 'text', { interview: { area: question.area, tipo: question.tipo, accion: question.accion, origen: origin, modelo: origin === 'qvac' ? model : null } });
}

export function startAdaptiveDiagnosis() {
  const session = { ...startSession(), mode: 'adaptativo' };
  return pack({ session, messages: session.messages });
}

async function openInterview(r, llm) {
  // El motor acaba de pasar a "tareas": se reemplaza su pregunta fija por la entrevista.
  const messages = r.messages.slice(0, -1);
  const session = { ...r.session, messages: r.session.messages.slice(0, -1), stage: 'entrevista', interview: createInterviewState() };
  const t = await runInterviewTurn({ state: session.interview, profile: session.profile, userText: null, llm });
  const q = questionMessage(t, llm.describe?.().model);
  return {
    session: { ...session, interview: t.state, messages: [...session.messages, q] },
    messages: [...messages, q],
  };
}

const STATUS_WORDS = { evidencia: 'con evidencia', declarada: 'declarada', por_validar: 'por validar' };

/** Mensaje que resume el análisis de competencias (o explica por qué no se pudo hacer). */
function analysisMessage(analysis, profile) {
  if (!analysis.ok) {
    const why = analysis.reason === 'qvac_no_disponible' ? 'QVAC no respondió a tiempo' : analysis.reason === 'sin_respuestas' ? 'no hubo respuestas que analizar' : 'su respuesta no se pudo validar';
    return bot(
      `No pude completar el análisis detallado de tus respuestas (${why}). Tu perfil muestra por ahora las competencias que fui reconociendo durante la conversación.`,
      'text',
      { analysis: { ok: false, reason: analysis.reason } },
    );
  }
  if (!analysis.competencies.length) {
    return bot('Revisé todo lo que me contaste y todavía no encuentro competencias claras con citas de tus respuestas.', 'text', { analysis: { ok: true, ids: [] } });
  }
  const parts = analysis.competencies.map((c) => `${COMPETENCIES[c.id].name} (${STATUS_WORDS[profile.competencies[c.id]?.status || c.status]})`);
  // En el chat, solo lo más importante; la lista completa queda en el perfil.
  const missing = analysis.missingInformation.length ? ` Para confirmarlas mejor me falta saber: ${analysis.missingInformation.slice(0, 2).join('; ')}.` : '';
  return bot(`Revisé todo lo que me contaste. Reconocí: ${joinNames(parts)}. Cada una se apoya en tus propias palabras.${missing}`, 'text', {
    ids: analysis.competencies.map((c) => c.id),
    analysis: { ok: true, model: analysis.model },
  });
}

/**
 * Cierre de la entrevista = momento de generar el perfil: se analiza el
 * relato completo UNA vez y luego siguen los ejemplos del motor.
 */
/**
 * Candidatas por similitud semántica (embeddings) para las frases de la
 * persona. Si la búsqueda no está disponible, el análisis sigue sin pistas.
 */
async function semanticHints(interview, profile, semantic) {
  if (!semantic?.suggest) return { hints: [], error: null };
  try {
    const fragments = userTextsOf(interview).flatMap((t) => splitFragments(t)).filter((f) => f.split(/\s+/).length >= 4).slice(0, 30);
    return { hints: await semantic.suggest(fragments, { dismissed: profile.dismissed }), error: null };
  } catch (error) {
    return { hints: [], error: error?.message || String(error) };
  }
}

/** Candidatas semánticas que el análisis NO validó: quedan «por confirmar», no en el perfil. */
function pendingCandidates(hints, profile) {
  const out = new Map();
  for (const h of hints) {
    for (const c of h.candidates) {
      if (profile.competencies[c.id] || profile.dismissed?.includes(c.id)) continue;
      if (!out.has(c.id) || c.similarity > out.get(c.id).similarity) out.set(c.id, { id: c.id, quote: h.quote, similarity: c.similarity, status: 'por_confirmar' });
    }
  }
  return [...out.values()];
}

async function closeInterview(session, extra, endedBy, llm, semantic) {
  const interview = endedBy ? { ...session.interview, done: true, endedBy } : session.interview;
  const { hints, error: hintsError } = await semanticHints(interview, session.profile, semantic);
  const analysis = await runCompetencyAnalysis({ interview, profile: session.profile, llm, hints });
  let profile = applyAnalysis(session.profile, analysis);
  profile = { ...profile, analysis: { ...profile.analysis, semanticHints: hints.length, pendingValidation: pendingCandidates(hints, profile) } };
  const log = { analisis: true, ok: analysis.ok, motivo: analysis.ok ? null : analysis.reason, ms: analysis.ms, intentos: analysis.tries, pistas: hints.length, errorPistas: hintsError };
  const next = { ...session, profile, interview: { ...interview, log: [...interview.log, log].slice(-40) } };
  const r = startEvidenceOrEmpty(next, [...extra, analysisMessage(analysis, profile)]);
  return withMessages(r);
}

async function interviewStep(session, input, llm, semantic) {
  const text = (input.text || '').trim();
  if (input.skip) {
    const u = user('Prefiero terminar aquí');
    const next = { ...session, messages: [...session.messages, u] };
    return closeInterview(next, [bot('Está bien, terminamos aquí. Gracias por lo que me contaste.')], 'persona', llm, semantic);
  }
  if (!text) return withMessages({ session, messages: [bot('Escribe tu respuesta con tus palabras. Puede ser corta.')] });

  const u = user(text);
  const answers = { ...session.profile.answers, entrevista: [session.profile.answers.entrevista, text].filter(Boolean).join(' ') };
  let next = { ...session, profile: { ...session.profile, answers }, messages: [...session.messages, u] };
  // El motor de reglas sigue registrando competencias potenciales («Declarada»)
  // para el perfil; la entrevista solo decide qué preguntar.
  // Las citas que se guardan como evidencia van sin correos ni números largos.
  next = registerFindings(next, redact(text), 'entrevista').session;

  const t = await runInterviewTurn({ state: next.interview, profile: next.profile, userText: text, llm });
  next = { ...next, interview: t.state };
  if (t.close) return closeInterview(next, [bot(CLOSING)], null, llm, semantic);
  return withMessages({ session: next, messages: [questionMessage(t, llm.describe?.().model)] });
}

/**
 * Avanza la conversación. Si QVAC falla, la promesa se rechaza y la sesión
 * recibida NO cambia: la persona puede reintentar con la misma respuesta.
 */
export async function advanceAdaptiveDiagnosis(session, input = {}, { llm, semantic = null }) {
  if (session.stage === 'entrevista') return pack(await interviewStep(session, input, llm, semantic));
  const r = advance(session, input);
  if (r.session.stage === 'tareas' && session.stage !== 'tareas') return pack(await openInterview(r, llm));
  return pack(r);
}
