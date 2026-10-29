import { COMPETENCIES } from '../../data/competencies.js';

export const PASSPORT_VERSION = 'valor-profesional-v1';

/** Only user-authored evidence, excluding competencies dismissed by the person. */
export function passportSources(profile) {
  const dismissed = new Set(profile?.dismissed || []);
  const texts = Object.values(profile?.competencies || {}).filter((c) => !dismissed.has(c.id)).flatMap((c) => [
    ...(c.examples || []).map((e) => e.text), ...(c.mentions || []).map((m) => m.quote),
  ]);
  return [...new Set(texts.filter((t) => typeof t === 'string' && t.trim()))].slice(0, 30)
    .map((text, i) => ({ id: `relato-${i + 1}`, text }));
}

/** Grounded presentation: prose is assembled from validated catalog ids and literal quotes.
 * QVAC proposes extractions; this function never promotes an inference into the profile.
 */
export function buildPassportContent({ profile, destination, evaluation, extracted = [], sources = passportSources(profile), simulation = false }) {
  const dismissed = new Set(profile?.dismissed || []);
  const own = profile?.competencies || {};
  const required = new Set(destination.requires.map((r) => r.id));
  const refs = (quote) => sources.filter((s) => s.text.includes(quote)).map((s) => s.id);
  const evidenceOf = (c) => [...(c?.examples || []).map((e) => ({ quote: e.text, strong: e.level === 'fuerte' })), ...(c?.mentions || []).map((m) => ({ quote: m.quote, strong: false }))]
    .filter((e) => e.quote && refs(e.quote).length);
  const strengths = [];
  const transferable = [];
  const inferred = [];
  const seenInferred = new Set();
  for (const req of destination.requires) {
    const c = own[req.id];
    if (!c || dismissed.has(req.id) || c.status !== 'evidencia') continue;
    const ev = evidenceOf(c).find((e) => e.strong);
    if (!ev) continue;
    strengths.push({ competencyId: req.id, name: COMPETENCIES[req.id].name, status: 'demostrada', quote: ev.quote, sourceIds: refs(ev.quote),
      relevance: `El puesto requiere ${COMPETENCIES[req.id].name.toLowerCase()}: ${COMPETENCIES[req.id].description}`, level: c.level || null });
  }
  for (const t of evaluation?.transferable || []) {
    const baseId = t.from?.id || t.base?.id;
    const c = own[baseId];
    if (!required.has(t.id) || !c || dismissed.has(baseId) || dismissed.has(t.id)) continue;
    const ev = evidenceOf(c).find((e) => e.strong) || evidenceOf(c)[0];
    if (!ev) continue;
    transferable.push({ competencyId: t.id, name: COMPETENCIES[t.id].name, baseId, baseName: COMPETENCIES[baseId].name,
      status: 'transferible_por_confirmar', quote: ev.quote, sourceIds: refs(ev.quote),
      relevance: `Tu experiencia en ${COMPETENCIES[baseId].name.toLowerCase()} puede ser aprovechable para ${COMPETENCIES[t.id].name.toLowerCase()}. ${t.why || t.base?.why || COMPETENCIES[t.id].description}`,
      question: COMPETENCIES[t.id].ask });
  }
  for (const c of extracted) {
    if (!required.has(c.id) || seenInferred.has(c.id) || dismissed.has(c.id) || own[c.id]?.status === 'evidencia' || strengths.some((s) => s.competencyId === c.id) || transferable.some((s) => s.competencyId === c.id)) continue;
    const ev = c.evidence?.find((e) => e.quote && refs(e.quote).length);
    if (!ev) continue;
    seenInferred.add(c.id);
    inferred.push({ competencyId: c.id, name: COMPETENCIES[c.id].name, status: 'inferida_por_confirmar', quote: ev.quote, sourceIds: refs(ev.quote),
      relevance: `Tu relato podría indicar ${COMPETENCIES[c.id].name.toLowerCase()}. Para este puesto se entiende como: ${COMPETENCIES[c.id].description}`,
      question: COMPETENCIES[c.id].ask });
  }
  const supported = strengths.slice(0, 4);
  const sourceIds = [...new Set(supported.flatMap((s) => s.sourceIds))];
  const names = supported.map((s) => s.name.toLowerCase()).join(', ');
  const presentation = supported.length ? {
    text: `Para ${destination.name}, mi experiencia en ${names} se apoya en tareas que ya he realizado. Un ejemplo: «${supported[0].quote}»`, sourceIds,
  } : null;
  const pitch = supported.length ? {
    text: `Cuento con experiencia en ${names}. Por ejemplo: «${supported[0].quote}»`, sourceIds,
  } : null;
  const differential = supported.length >= 2 && sourceIds.length >= 2 ? {
    text: `Para ${destination.name}, puedes conectar ${supported[0].name.toLowerCase()} («${supported[0].quote}») con ${supported[1].name.toLowerCase()} («${supported[1].quote}»). Esta combinación reúne dos experiencias concretas relacionadas con lo que pide el puesto.`, sourceIds: [...new Set(supported.slice(0, 2).flatMap((s) => s.sourceIds))],
  } : null;
  const questions = [...inferred, ...transferable].map((c) => ({ competencyId: c.competencyId, text: c.question, sourceIds: c.sourceIds }));
  if (!strengths.length) {
    for (const r of destination.requires.filter((r) => !dismissed.has(r.id))) {
      if (!questions.some((q) => q.competencyId === r.id)) questions.push({ competencyId: r.id, text: COMPETENCIES[r.id].ask, sourceIds: [] });
      if (questions.length >= 3) break;
    }
  }
  return { version: PASSPORT_VERSION, occupationId: destination.id,
    target: { id: destination.id, name: destination.name, summary: destination.summary || '', synthetic: Boolean(destination.synthetic) },
    presentation, strengths, transferable, inferred, differential, pitch, questions: questions.slice(0, 4), sources,
    simulation, personalization: { engine: simulation ? 'reglas-locales' : 'qvac', ok: true },
  };
}
