import { STATUS } from '../../src/services/engine/profile.js';
import { PROMPT_VERSION } from './schema.js';

/**
 * Incorpora un análisis YA VALIDADO al perfil de la sesión (sin modificarlo).
 *
 * - Nunca baja un estado ni toca las competencias descartadas.
 * - Las citas se agregan como menciones (`source: 'entrevista'`, `origin: 'qvac'`),
 *   sin repetir. Una cita de ejemplo concreto que sostiene «evidencia» se
 *   agrega además como ejemplo fuerte, como hace hoy la etapa de ejemplos.
 * - `profile.analysis` deja constancia de cómo se hizo (o por qué no se pudo).
 */
export function applyAnalysis(profile, analysis, { at = new Date().toISOString() } = {}) {
  const meta = {
    engine: 'qvac',
    promptVersion: PROMPT_VERSION,
    at,
    ok: analysis.ok,
    model: analysis.model || null,
    reason: analysis.ok ? null : analysis.reason,
    missingInformation: analysis.ok ? analysis.missingInformation : [],
    ids: analysis.ok ? analysis.competencies.map((c) => c.id) : [],
  };
  if (!analysis.ok) return { ...profile, analysis: meta };

  const competencies = { ...profile.competencies };
  for (const found of analysis.competencies) {
    if (profile.dismissed?.includes(found.id)) continue;
    const current = competencies[found.id] || { id: found.id, status: found.status, mentions: [], examples: [] };
    const status = STATUS[found.status].rank > STATUS[current.status].rank ? found.status : current.status;
    const mentions = [...current.mentions];
    for (const ev of found.evidence) {
      if (!mentions.some((m) => m.quote === ev.quote)) mentions.push({ quote: ev.quote, source: 'entrevista', origin: 'qvac', type: ev.type });
    }
    const examples = [...current.examples];
    if (found.status === 'evidencia') {
      const ex = found.evidence.find((e) => e.type === 'ejemplo_concreto');
      if (ex && !examples.some((e) => e.text === ex.quote)) examples.push({ text: ex.quote, level: 'fuerte', at, source: 'entrevista' });
    }
    competencies[found.id] = {
      ...current,
      status,
      mentions,
      examples,
      ...(found.level ? { level: found.level, levelReason: found.levelReason } : {}),
    };
  }
  return { ...profile, competencies, analysis: meta };
}
