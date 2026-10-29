/**
 * Reglas de la evaluación de competencias, compartidas por el backend (que
 * corrige) y la interfaz (que muestra y comprueba el resumen recibido).
 *
 * Dos preguntas por competencia. Una competencia se registra como aprobada en
 * el intento solo si ambas respuestas coinciden con la clave validada. Dos
 * respuestas describen el desempeño en esas situaciones, no el dominio
 * integral de la competencia.
 */
export const QUESTIONS_PER_COMPETENCY = 2;

export const RESULT_LABELS = {
  approved: 'Aprobada en esta evaluación',
  notApproved: 'Por reforzar según esta evaluación',
  correct: 'Respuesta alineada con la práctica evaluada',
  incorrect: 'Respuesta por reforzar',
};

/**
 * @param {{ competencyId: string, competencyName?: string, correct: boolean }[]} items resultados por pregunta
 * @returns {{ competencies: { competencyId, name, correct, total, approved }[], approvedCount, evaluatedCount, correct, total }}
 */
export function summarizeAssessment(items) {
  const byCompetency = new Map();
  for (const item of items) {
    const entry = byCompetency.get(item.competencyId) || { competencyId: item.competencyId, name: item.competencyName || item.competencyId, correct: 0, total: 0 };
    entry.total += 1;
    if (item.correct === true) entry.correct += 1;
    byCompetency.set(item.competencyId, entry);
  }
  const competencies = [...byCompetency.values()].map((c) => ({ ...c, approved: c.total === QUESTIONS_PER_COMPETENCY && c.correct === c.total }));
  return {
    competencies,
    approvedCount: competencies.filter((c) => c.approved).length,
    evaluatedCount: competencies.length,
    correct: items.filter((i) => i.correct === true).length,
    total: items.length,
  };
}

/** Competencias del perfil que están en la sección «con evidencia» (sin las descartadas). */
export function evidenceCompetencyIds(profile) {
  const dismissed = new Set(profile?.dismissed || []);
  return Object.values(profile?.competencies || {}).filter((c) => c?.status === 'evidencia' && !dismissed.has(c.id)).map((c) => c.id);
}
