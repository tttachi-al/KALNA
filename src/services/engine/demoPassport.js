import { evaluateRequirements } from './matcher.js';
import { getTarget } from './targets.js';
import { extractCompetencies } from './extractor.js';
import { buildPassportContent, passportSources } from './passportContent.js';

export function buildDemoPassport(profile, occupationId, target = null) {
  const destination = getTarget(occupationId, profile) || target;
  if (!destination || destination.id !== occupationId) throw new Error('Selecciona un puesto válido para crear el pasaporte de simulación.');
  const dismissed = new Set(profile?.dismissed || []);
  const own = Object.fromEntries(Object.entries(profile?.competencies || {}).filter(([id]) => !dismissed.has(id)));
  const sources = passportSources(profile);
  const extracted = sources.flatMap((s) => extractCompetencies(s.text).map((c) => ({ id: c.id, evidence: [{ quote: c.quote }] })));
  const passport = buildPassportContent({ profile, destination, evaluation: evaluateRequirements(destination.requires, own), extracted, sources, simulation: true });
  return { ...passport, persistence: { saved: false, local: true } };
}
