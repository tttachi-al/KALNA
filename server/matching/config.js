/**
 * Parámetros de la búsqueda semántica y de la compatibilidad laboral
 * (`compat-v3`). Cambiar un valor = nueva versión.
 * v2: una certificación o licencia obligatoria sin verificar limita la banda a «media».
 * v3: si la persona tiene la competencia, cuenta siempre como directa (no la reemplaza una
 *     transferencia); la descripción general del empleo también ordena (no filtra) candidatos:
 *     pone primero un empleo pertinente en 7/7 casos de calibración, pero sus valores absolutos
 *     se solapan con frases sin relación (pertinentes min 0,437 · negativos max 0,547).
 *
 * Umbrales de similitud calibrados el 2026-10-28 con `npm run matching:calibrate`
 * (EMBEDDINGGEMMA_300M_Q8_0, versión a0f7b4e1…, casos `calibracion-v1`):
 *
 *   evidencia → competencia   positivos (comp. correcta en top-3): min 0,513 · p25 0,583 · med 0,619
 *                             negativos: max 0,486 · ambiguos: 0,535–0,563
 *                             top-1 24/26 · top-3 25/26
 *   competencia ↔ competencia pares `bases`: min 0,680 · p25 0,702 · pares sin relación: max 0,661
 *                             (mediana de todos los pares: 0,650)
 *   evidencia → tarea         aciertos: min 0,547 · negativos: max 0,520
 *
 * Las similitudes SOLO proponen candidatos o relaciones; nunca son un
 * porcentaje de compatibilidad.
 */
export const MATCHING_CONFIG = {
  version: 'compat-v3',

  semantic: {
    // Candidata para el análisis de competencias (pista para QVAC; la valida el código).
    candidate: 0.49, // separa positivos (min 0,513) de negativos (max 0,486)
    candidateMargin: 0.03, // además, a no más de 0,03 de la mejor competencia de esa evidencia
    // «Posible, por confirmar» en la compatibilidad: más estricto, deja fuera las frases ambiguas (max 0,563).
    possible: 0.575,
    // Transferencia semántica entre competencias (si no hay relación `bases`).
    transfer: 0.7, // sobre todos los pares sin relación (max 0,661)
    transferHigh: 0.8,
    // Tarea de un empleo parecida a una evidencia de la persona.
    task: 0.535, // entre negativos (max 0,520) y aciertos (min 0,547)
    tasksPerEvidence: 10,
  },

  // Importancia de cada competencia requerida por el empleo.
  weights: { clave: 1, complementaria: 0.5 },
  // Cuánto cuenta una competencia del perfil según su respaldo.
  statusFactor: { evidencia: 1, declarada: 0.7, por_validar: 0.4 },
  // Cobertura máxima de una competencia que la persona NO tiene, pero puede transferir.
  transfer: {
    bases: 0.5, // relación de base transferible del catálogo
    semanticMin: 0.15, // similitud = umbral de transferencia
    semanticMax: 0.35, // similitud ≥ transferHigh
  },
  // Evidencia que se parece a la competencia requerida, pero la competencia no está validada.
  possible: 0.15,

  // Bandas (sobre la cobertura ponderada de competencias; no es probabilidad de contratación).
  bands: {
    alta: 0.6, // y todas las clave cubiertas (directa o transferible) y al menos una con evidencia
    media: 0.35, // y al menos una coincidencia directa
    minimo: 0.15, // por debajo, el empleo no se recomienda
  },
  // Requisitos obligatorios que, mientras no se verifiquen, limitan la banda a «media».
  barrierKinds: ['certificacion', 'licencia'],
  // La relevancia semántica (tareas o descripción) solo ordena dentro de cada banda.
  taskRankWeight: 0.1,
  maxResults: 10,
};

/** Requisitos que no son competencias y se muestran «por verificar». */
export const VERIFIABLE_REQUIREMENTS = new Set(['educacion', 'experiencia', 'certificacion', 'licencia', 'formacion', 'condicion']);
