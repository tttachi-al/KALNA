import { randomBytes, randomUUID } from 'node:crypto';
import { COMPETENCIES } from '../../src/data/competencies.js';
import { OCCUPATIONS } from '../../src/data/occupations.js';
import { QUESTIONS_PER_COMPETENCY, evidenceCompetencyIds, summarizeAssessment } from '../../src/services/engine/assessment.js';
import { bankQuestionsFor, loadBank } from './bank.js';
import { certificateFilename, PDF_MIME, renderCertificatePdf } from './certificate.js';
import { generateCompetencyQuestions, similarity } from './generate.js';

/**
 * Evaluación de competencias con dos preguntas por competencia «con evidencia».
 *
 * - `start` crea el intento y prepara las preguntas en segundo plano (QVAC puede
 *   tardar minutos); la interfaz consulta `get` hasta que el estado sea `lista`.
 * - Las claves y la corrección viven solo aquí. La interfaz recibe alternativas
 *   con identificadores opacos y en orden aleatorio.
 * - La constancia se genera solo para competencias aprobadas por el backend.
 */
const MAX_COMPETENCIES = 8;
const GENERATION_ROUNDS = 4;
const NAME_PATTERN = /^[\p{L}][\p{L} .'’-]{1,79}$/u;
const fail = (status, message, code) => { throw Object.assign(new Error(message), { status, code }); };

function contextOf(profile) {
  if (OCCUPATIONS[profile.target]) return { occupationId: profile.target, name: OCCUPATIONS[profile.target].name };
  if (profile.targetJob?.name) return { occupationId: null, name: profile.targetJob.name };
  const occupations = (profile.experience?.occupations || []).filter((o) => OCCUPATIONS[o]);
  return occupations.length ? { occupationId: occupations[0], name: occupations.map((o) => OCCUPATIONS[o].name).join(' / ') } : { occupationId: null, name: 'Contexto laboral general' };
}

function evidenceOf(competency) {
  const texts = [...(competency.examples || []).filter((e) => e.level !== 'debil').map((e) => e.text), ...(competency.mentions || []).map((m) => m.quote)];
  return [...new Set(texts.filter((t) => typeof t === 'string' && t.trim()))];
}

export function createAssessmentService({ llm = null, store, bank = loadBank(), log = () => {}, random = Math.random }) {
  const preparing = new Map();
  const token = () => randomBytes(5).toString('hex');
  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  const qvacReady = () => llm?.describe?.().status === 'ready';

  /** Pregunta lista para el intento: alternativas barajadas con identificadores opacos. */
  function makeItem(competency, q, source) {
    const options = shuffle(q.options.map((text, index) => ({ token: token(), text, correct: index === q.correctIndex })));
    return { id: `p${token()}`, competencyId: competency.id, competencyName: competency.name, source, situation: q.situation, explanation: q.explanation, bankId: q.bankId || null,
      options: options.map(({ token: t, text }) => ({ token: t, text })), correctToken: options.find((o) => o.correct).token };
  }
  const fromBank = (q) => ({ situation: q.situation, options: q.options.map((o) => o.text), correctIndex: q.options.findIndex((o) => o.id === q.correctOptionId), explanation: q.explanation, bankId: q.id });

  async function prepareCompetency(attempt, competency, evidence) {
    const references = bankQuestionsFor(bank, competency.id, attempt.context.occupationId);
    const chosen = [];
    const notes = [];
    if (qvacReady()) {
      // Varias rondas cortas: muchas preguntas no pasan la verificación. Desde la
      // segunda, sin preguntas de referencia, porque el modelo tiende a copiarlas.
      for (const refs of [references, ...Array(GENERATION_ROUNDS - 1).fill([])]) {
        if (chosen.length >= QUESTIONS_PER_COMPETENCY) break;
        try {
          const r = await generateCompetencyQuestions({ llm, competency: { name: competency.name, description: COMPETENCIES[competency.id].description }, context: attempt.context.name, evidence, references: refs, random });
          for (const q of r.questions) {
            if (chosen.length < QUESTIONS_PER_COMPETENCY && !chosen.some((c) => similarity(c.q.situation, q.situation) > 0.5) && !references.some((ref) => similarity(ref.situation, q.situation) > 0.45)) chosen.push({ q, source: 'qvac' });
          }
          notes.push(...r.rejected);
        } catch (error) {
          notes.push(`QVAC no generó preguntas: ${error.message}`);
          break;
        }
      }
    } else notes.push('QVAC no está disponible; se usan preguntas del banco validado.');
    // Respaldo: preguntas del banco validado, sin repetir una situación casi igual a la generada.
    for (const ref of references) {
      if (chosen.length >= QUESTIONS_PER_COMPETENCY) break;
      if (chosen.some((c) => similarity(c.q.situation, ref.situation) > 0.5)) continue;
      chosen.push({ q: fromBank(ref), source: 'banco' });
    }
    if (chosen.length < QUESTIONS_PER_COMPETENCY) return { items: [], gap: { competencyId: competency.id, name: competency.name, reason: 'No se pudieron preparar dos preguntas validadas para esta competencia en este intento.' }, notes };
    return { items: chosen.map(({ q, source }) => makeItem(competency, q, source)), gap: null, notes };
  }

  async function prepare(attempt, profile) {
    try {
      for (const competency of attempt.competencies) {
        attempt.progress = { done: attempt.progress.done, total: attempt.competencies.length, current: competency.name };
        await store.save(attempt);
        const r = await prepareCompetency(attempt, competency, evidenceOf(profile.competencies[competency.id]));
        attempt.items.push(...r.items);
        if (r.gap) attempt.gaps.push(r.gap);
        if (r.notes.length) log(`Evaluación ${attempt.id.slice(0, 8)} · ${competency.id}: ${r.notes.join(' ')}`);
        attempt.progress = { done: attempt.progress.done + 1, total: attempt.competencies.length, current: null };
      }
      attempt.qvac.used = attempt.items.some((i) => i.source === 'qvac');
      if (!attempt.items.length) Object.assign(attempt, { status: 'error', error: 'No se pudieron preparar preguntas validadas para ninguna competencia. Inténtalo de nuevo más tarde.' });
      else attempt.status = 'lista';
    } catch (error) {
      log(`Evaluación ${attempt.id.slice(0, 8)}: ${error.message}`);
      Object.assign(attempt, { status: 'error', error: 'La preparación de la evaluación falló. Inténtalo de nuevo.' });
    } finally {
      attempt.updatedAt = new Date().toISOString();
      await store.save(attempt).catch((e) => log(`No se pudo guardar la evaluación ${attempt.id.slice(0, 8)}: ${e.message}`));
      preparing.delete(attempt.id);
    }
  }

  /** Vista para la interfaz: nunca incluye claves antes de corregir. */
  function view(attempt) {
    const completed = attempt.status === 'completada';
    return {
      id: attempt.id, status: attempt.status, createdAt: attempt.createdAt, completedAt: attempt.completedAt || null, simulation: attempt.simulation, persistent: store.persistent,
      context: attempt.context.name, progress: attempt.progress, error: attempt.error || null, gaps: attempt.gaps,
      qvac: { available: attempt.qvac.available, used: attempt.qvac.used },
      competencies: attempt.competencies.map(({ id, name }) => ({ id, name })),
      items: ['lista', 'completada'].includes(attempt.status) ? attempt.items.map((i) => ({ id: i.id, competencyId: i.competencyId, competencyName: i.competencyName, source: i.source, situation: i.situation, options: i.options.map((o) => ({ id: o.token, text: o.text })) })) : [],
      results: completed ? attempt.results : null,
    };
  }

  async function load(id) {
    const attempt = await store.get(id);
    if (!attempt) fail(404, 'No encontré esta evaluación. Puede haber expirado; empieza una nueva.', 'assessment_not_found');
    if (attempt.status === 'preparando' && !preparing.has(id)) {
      // El servidor se reinició durante la preparación.
      Object.assign(attempt, { status: 'error', error: 'La preparación se interrumpió. Empieza una nueva evaluación.' });
      await store.save(attempt);
    }
    return attempt;
  }

  return {
    async start({ profile, profileId = null, simulation = false, competencyIds = null }) {
      const available = evidenceCompetencyIds(profile).filter((id) => COMPETENCIES[id]);
      const selected = Array.isArray(competencyIds) && competencyIds.length ? available.filter((id) => competencyIds.includes(id)) : available;
      if (!available.length) fail(422, 'Todavía no tienes competencias con evidencia. Agrega un ejemplo concreto a una competencia para evaluarla.', 'no_evidence');
      if (!selected.length) fail(400, 'Selecciona al menos una competencia con evidencia.', 'no_selection');
      if (selected.length > MAX_COMPETENCIES) fail(400, `Puedes evaluar hasta ${MAX_COMPETENCIES} competencias por intento.`, 'too_many');
      const now = new Date().toISOString();
      const attempt = {
        id: randomUUID(), profileId, simulation, status: 'preparando', createdAt: now, updatedAt: now, context: contextOf(profile),
        competencies: selected.map((id) => ({ id, name: COMPETENCIES[id].name })), progress: { done: 0, total: selected.length, current: null },
        items: [], gaps: [], answers: null, results: null, qvac: { available: qvacReady(), used: false },
      };
      await store.save(attempt);
      const job = prepare(attempt, profile);
      preparing.set(attempt.id, job);
      return view(attempt);
    },

    async get(id) {
      return view(await load(id));
    },

    /** Corrige en el servidor. Las respuestas son { [preguntaId]: idAlternativa }. */
    async submit(id, answers) {
      const attempt = await load(id);
      if (attempt.status === 'completada') return view(attempt);
      if (attempt.status !== 'lista') fail(409, 'La evaluación todavía no está lista para responder.', 'assessment_not_ready');
      if (!answers || typeof answers !== 'object') fail(400, 'Faltan las respuestas.', 'missing_answers');
      const missing = attempt.items.filter((i) => !i.options.some((o) => o.token === answers[i.id]));
      if (missing.length) fail(400, `Responde todas las preguntas antes de enviar (${missing.length} sin responder).`, 'incomplete_answers');
      const items = attempt.items.map((i) => ({
        itemId: i.id, competencyId: i.competencyId, competencyName: i.competencyName, selected: answers[i.id], correctOption: i.correctToken,
        correct: answers[i.id] === i.correctToken, explanation: i.explanation, source: i.source,
      }));
      const completedAt = new Date().toISOString();
      Object.assign(attempt, { answers: Object.fromEntries(attempt.items.map((i) => [i.id, answers[i.id]])), results: { items, ...summarizeAssessment(items) }, status: 'completada', completedAt, updatedAt: completedAt });
      await store.save(attempt);
      return view(attempt);
    },

    /** Constancia de una competencia aprobada o, sin competencyId, la consolidada. */
    async certificate(id, { competencyId = null, participantName = null, participantNameConfirmed = false } = {}) {
      const attempt = await load(id);
      if (attempt.status !== 'completada') fail(409, 'Termina la evaluación para obtener una constancia.', 'assessment_incomplete');
      const approved = attempt.results.competencies.filter((c) => c.approved);
      const selected = competencyId ? approved.filter((c) => c.competencyId === competencyId) : approved;
      if (!selected.length) fail(403, competencyId ? 'Esta competencia no se aprobó en esta evaluación; no corresponde una constancia de aprobación.' : 'No hay competencias aprobadas en esta evaluación.', 'not_approved');
      let name = null;
      if (participantName != null && String(participantName).trim()) {
        name = String(participantName).trim().replace(/\s+/g, ' ');
        if (!participantNameConfirmed) fail(400, 'Confirma que el nombre es correcto para incluirlo en la constancia.', 'name_not_confirmed');
        if (!NAME_PATTERN.test(name)) fail(400, 'Escribe el nombre solo con letras y espacios (máximo 80 caracteres).', 'invalid_name');
      }
      const buffer = await renderCertificatePdf({
        attemptId: attempt.id, participantName: name, context: attempt.context.name, completedAt: attempt.completedAt, simulation: attempt.simulation, consolidated: !competencyId, evaluatedCount: attempt.results.evaluatedCount,
        competencies: selected.map((c) => ({ ...c, sources: attempt.results.items.filter((i) => i.competencyId === c.competencyId).map((i) => i.source) })),
      });
      if (!Buffer.isBuffer(buffer) || buffer.length < 500 || buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('No se pudo construir la constancia en PDF.');
      return { buffer, filename: certificateFilename(attempt.id, competencyId), contentType: PDF_MIME };
    },

    /** Para pruebas y apagado: espera a que termine la preparación en curso. */
    idle: (id) => preparing.get(id) || Promise.resolve(),
  };
}
