import { readFileSync } from 'node:fs';
import { COMPETENCIES } from '../../src/data/competencies.js';
import { ASSESSMENT_PROFILES } from './annotations.js';
import { BANK_FILE } from './import.js';

/**
 * Banco de preguntas validadas (bank.json, generado desde el material original).
 * Sirve de referencia para que QVAC genere situaciones nuevas y de respaldo
 * cuando QVAC no está disponible o sus preguntas no pasan la validación.
 */
export const OPTION_COUNT = 5;

/** Competencia del catálogo de KALLPA que mide una pregunta del banco. */
export function catalogIdOf(q) {
  const configured = ASSESSMENT_PROFILES[q.occupationId]?.find((c) => c.key === q.competencyKey);
  return configured ? configured.catalogId : COMPETENCIES[q.competencyKey] ? q.competencyKey : null;
}

export function validateQuestion(q) {
  const problems = [];
  if (!/^[a-z]+-[\w-]+$/.test(q?.id || '')) problems.push('id');
  if (!ASSESSMENT_PROFILES[q?.occupationId]) problems.push('occupationId');
  if (!catalogIdOf(q || {})) problems.push('competencyKey');
  if (typeof q?.situation !== 'string' || q.situation.trim().length < 20) problems.push('situation');
  const ids = (q?.options || []).map((o) => o.id);
  if (ids.length !== OPTION_COUNT || new Set(ids).size !== OPTION_COUNT) problems.push('options');
  if ((q?.options || []).some((o) => typeof o.text !== 'string' || !o.text.trim())) problems.push('options.text');
  else if (new Set(q.options.map((o) => o.text.trim().toLowerCase())).size !== OPTION_COUNT) problems.push('options.duplicated');
  if (!ids.includes(q?.correctOptionId)) problems.push('correctOptionId');
  if (!['validada', 'pendiente', 'rechazada'].includes(q?.validation?.status)) problems.push('validation.status');
  return problems;
}

export function loadBank(file = BANK_FILE) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const seen = new Set();
  for (const q of data.questions) {
    const problems = validateQuestion(q);
    if (seen.has(q.id)) problems.push('id duplicado');
    seen.add(q.id);
    if (problems.length) throw new Error(`Pregunta ${q.id} inválida en el banco: ${problems.join(', ')}`);
  }
  return data.questions;
}

/** Preguntas validadas de una competencia del catálogo; primero las del puesto indicado. */
export function bankQuestionsFor(bank, competencyId, occupationId = null) {
  return bank
    .filter((q) => q.validation.status === 'validada' && catalogIdOf(q) === competencyId)
    .sort((a, b) => (b.occupationId === occupationId) - (a.occupationId === occupationId));
}
