import { COMPETENCIES } from '../../src/data/competencies.js';
import { MATCHING_CONFIG, VERIFIABLE_REQUIREMENTS } from './config.js';

/**
 * Compatibilidad laboral explicable (función pura, sin base de datos ni modelo).
 *
 * Para cada competencia requerida r (peso w: clave 1, complementaria 0,5):
 *
 *   cobertura(r) = máximo de
 *     directa       f(estado de r en el perfil)          evidencia 1 · declarada 0,7 · por validar 0,4
 *     transferible  f(estado de p) · t(p, r)             t = 0,5 si p es BASE de r en el catálogo;
 *                                                        si no, 0,15–0,35 según la similitud entre
 *                                                        competencias (solo si ≥ umbral calibrado)
 *     posible       0,15                                 una evidencia se parece a r, pero r no está validada
 *
 *   cobertura del empleo = Σ w·cobertura(r) / Σ w
 *
 * - Transferir NUNCA equivale a experiencia directa (tope 0,5 · f).
 * - Los requisitos (estudios, licencias, certificaciones…) quedan «por
 *   verificar»: no restan cobertura; se muestran aparte.
 * - La banda depende de la cobertura Y de condiciones explicables (ver config).
 *   Si el empleo exige una certificación o licencia que aún no se verificó, la
 *   banda máxima es «media» (no se resta cobertura: no es un incumplimiento).
 * - La similitud de tareas solo ordena y aporta razones.
 */
const BAND_TO_CLOSENESS = { alta: 'muy-cercana', media: 'cercana', exploratoria: 'por-explorar' };
const BAND_RANK = { alta: 3, media: 2, exploratoria: 1 };
const round = (x) => Math.round(x * 1000) / 1000;

/** Fuerza de transferencia de p → r: relación `bases` o similitud semántica calibrada. */
export function transferStrength(p, r, similarity, config = MATCHING_CONFIG) {
  const base = COMPETENCIES[r]?.bases?.find((b) => b.id === p);
  if (base) return { strength: config.transfer.bases, via: 'bases', why: base.why, similarity: similarity ?? null };
  if (similarity == null || similarity < config.semantic.transfer) return null;
  const { transfer: lo, transferHigh: hi } = config.semantic;
  const k = Math.min(1, (similarity - lo) / (hi - lo));
  const strength = config.transfer.semanticMin + k * (config.transfer.semanticMax - config.transfer.semanticMin);
  return { strength, via: 'semantica', why: `Competencias relacionadas por su significado (similitud ${similarity.toFixed(2)}).`, similarity };
}

/**
 * @param {object} p
 * @param {{ id, name, sector, summary, requires: {id, weight}[], requirements: {kind, text, mandatory}[] }} p.job
 * @param {Map<string, { status: string, quotes: string[] }>} p.own   competencias NO descartadas del perfil
 * @param {(a: string, b: string) => number|undefined} p.similarity    similitud entre competencias
 * @param {Map<string, { quote: string, similarity: number }>} p.possible
 * @param {{ task: string, quote: string, similarity: number }[]} p.tasks
 */
export function evaluateJob({ job, own, similarity = () => undefined, possible = new Map(), tasks = [], config = MATCHING_CONFIG }) {
  const matches = [];
  const transferable = [];
  const possibles = [];
  const gaps = [];
  let score = 0;
  let max = 0;

  for (const req of job.requires) {
    const w = config.weights[req.weight];
    max += w;
    const mine = own.get(req.id);
    let best = null;
    if (mine) {
      // Si la persona tiene la competencia, es SIEMPRE una coincidencia directa con su
      // estado real (aunque sea «por validar»): una transferencia no la reemplaza.
      best = { kind: 'directa', value: config.statusFactor[mine.status] ?? 0 };
    } else {
      // Transferencia desde otra competencia del perfil: la más fuerte.
      for (const [pid, p] of own) {
        const t = transferStrength(pid, req.id, similarity(pid, req.id), config);
        if (!t) continue;
        const value = (config.statusFactor[p.status] ?? 0) * t.strength;
        if (!best || value > best.value) best = { kind: 'transferible', value, from: pid, ...t };
      }
      const pos = possible.get(req.id);
      if (pos && (!best || config.possible > best.value)) best = { kind: 'posible', value: config.possible, ...pos };
    }

    if (!best) {
      gaps.push({ id: req.id, weight: req.weight });
      continue;
    }
    score += w * best.value;
    if (best.kind === 'directa') {
      matches.push({ id: req.id, weight: req.weight, status: mine.status, quote: mine.quotes[0] || null, evidence: mine.quotes.slice(0, 3) });
    } else if (best.kind === 'transferible') {
      const from = own.get(best.from);
      transferable.push({
        id: req.id,
        weight: req.weight,
        via: best.via,
        strength: round(best.strength),
        similarity: best.similarity == null ? null : round(best.similarity),
        why: best.why,
        from: { id: best.from, status: from.status, quote: from.quotes[0] || null },
        // Compatibilidad con el contrato anterior (matcher.js): la competencia base.
        base: { id: best.from, why: best.why, status: from.status },
      });
    } else {
      possibles.push({ id: req.id, weight: req.weight, quote: best.quote, similarity: round(best.similarity) });
      gaps.push({ id: req.id, weight: req.weight, possible: true });
    }
  }

  const ratio = max ? score / max : 0;
  const keys = job.requires.filter((r) => r.weight === 'clave');
  const covered = (id) => matches.some((m) => m.id === id) || transferable.some((t) => t.id === id);
  const allKeysCovered = keys.every((r) => covered(r.id));
  const hasEvidence = matches.some((m) => m.status === 'evidencia');
  const pendingBarrier = (job.requirements || []).find((r) => r.mandatory && config.barrierKinds.includes(r.kind));
  let band = null;
  if (ratio >= config.bands.alta && allKeysCovered && hasEvidence && !pendingBarrier) band = 'alta';
  else if (ratio >= config.bands.media && matches.length > 0) band = 'media';
  else if (ratio >= config.bands.minimo && matches.length + transferable.length > 0) band = 'exploratoria';

  const pending = (job.requirements || [])
    .filter((r) => r.mandatory && VERIFIABLE_REQUIREMENTS.has(r.kind))
    .map((r) => ({ kind: r.kind, text: r.text, status: 'por_verificar' }));
  const optional = (job.requirements || []).filter((r) => !r.mandatory).map((r) => ({ kind: r.kind, text: r.text }));
  const taskEvidence = [...tasks].sort((a, b) => b.similarity - a.similarity).slice(0, 3).map((t) => ({ ...t, similarity: round(t.similarity) }));
  const taskRelevance = taskEvidence.length ? Math.max(0, Math.min(1, (taskEvidence[0].similarity - config.semantic.task) / (1 - config.semantic.task))) : 0;

  const name = (id) => COMPETENCIES[id]?.name || id;
  const reasons = [
    ...matches.map((m) => `${name(m.id)}: ${m.status === 'evidencia' ? 'la respaldas con un ejemplo concreto' : m.status === 'declarada' ? 'la mencionaste; falta un ejemplo concreto' : 'hay un indicio; falta confirmarla'}${m.quote ? ` («${m.quote}»)` : ''}.`),
    ...transferable.map((t) => `${name(t.id)}: puedes desarrollarla a partir de ${name(t.from.id)}${t.via === 'bases' ? '' : ' (relación por significado)'}; no equivale a experiencia directa.`),
    ...possibles.map((p) => `${name(p.id)}: tu frase «${p.quote}» podría mostrarla, pero falta confirmarla.`),
    ...taskEvidence.slice(0, 1).map((t) => `Lo que contaste («${t.quote}») se parece a la tarea «${t.task}».`),
    ...(pendingBarrier ? [`Requiere ${pendingBarrier.text.charAt(0).toLowerCase()}${pendingBarrier.text.slice(1)}: falta verificarlo.`] : []),
  ];

  return {
    jobId: job.id,
    name: job.name,
    area: job.sector,
    summary: job.summary,
    synthetic: true,
    url: null,
    search: null,
    band,
    closeness: band ? BAND_TO_CLOSENESS[band] : null,
    ratio: round(ratio),
    keyCompetencies: { total: keys.length, direct: keys.filter((r) => matches.some((m) => m.id === r.id)).length, transferable: keys.filter((r) => transferable.some((t) => t.id === r.id)).length },
    matches,
    transferable,
    possible: possibles,
    gaps,
    pendingRequirements: pending,
    optionalRequirements: optional,
    taskEvidence,
    taskRelevance: round(taskRelevance),
    reasons,
    configVersion: config.version,
  };
}

/** Relevancia semántica para ordenar: la mayor entre tareas (≥ umbral) y descripción (normalizada). */
export const relevance = (r) => Math.max(r.taskRelevance || 0, r.descriptionRelevance || 0);

/** Orden: banda, luego cobertura + peso pequeño de la relevancia semántica. */
export function rankResults(results, config = MATCHING_CONFIG) {
  const key = (r) => r.ratio + config.taskRankWeight * relevance(r);
  return results
    .filter((r) => r.band)
    .sort((a, b) => BAND_RANK[b.band] - BAND_RANK[a.band] || key(b) - key(a) || a.jobId.localeCompare(b.jobId));
}
