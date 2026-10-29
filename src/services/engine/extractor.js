import { COMPETENCIES } from '../../data/competencies.js';
import { maskOccupationWords, normalize, splitFragments, trimQuote } from './text.js';

/**
 * Detecta competencias POTENCIALES en un texto libre.
 *
 * Motor de demostración basado en reglas. No es IA y no certifica nada:
 * solo propone competencias que aparecen en lo que la persona contó.
 * En producción, esta función se reemplaza por el análisis de QVAC
 * (ver src/services/adapters/qvacAdapter.js).
 *
 * @param {string} text  Texto escrito por la persona
 * @returns {{id: string, quote: string}[]}
 */
export function extractCompetencies(text) {
  const fragments = splitFragments(text);
  const found = new Map();

  for (const fragment of fragments) {
    const normalized = maskOccupationWords(normalize(fragment));
    for (const competency of Object.values(COMPETENCIES)) {
      if (found.has(competency.id)) continue;
      if (competency.signals.some((rx) => rx.test(normalized))) {
        found.set(competency.id, { id: competency.id, quote: trimQuote(fragment) });
      }
    }
  }
  return [...found.values()];
}

/** Ocupaciones mencionadas en un texto libre (solo las cinco del proyecto). */
const OCCUPATION_KEYWORDS = {
  limpieza: /\b(limpi\w*|conserj\w*|aseo|mantenimiento de (oficinas|locales))\b/,
  administrativo: /\b(administrativ\w*|oficina\w*|secretari\w*|asistente|archivo)\b/,
  reponedor: /\b(repon\w*|abastec\w*|almacen\w*|mercaderia|estantes?|supermercado)\b/,
  vendedor: /\b(vend\w*|venta\w*|tienda\w*|bodega\w*|comercio)\b/,
  cajero: /\b(caja|cajer\w*|cobr\w*)\b/,
};

/** Palabras que indican ocupaciones fuera del alcance de KALLPA. */
const OUT_OF_SCOPE =
  /\b(constru\w*|albanil\w*|cocin\w*|mozo|moza|mesero\w*|chofer|conductor\w*|taxi\w*|vigilan\w*|seguridad privada|costur\w*|agricul\w*|chacra|mecanic\w*|electricist\w*|enfermer\w*|profesor\w*|docente|repartidor\w*|obrer\w*|carpinter\w*|pintor\w*|ninera|cuidador\w*|peluquer\w*|programador\w*)\b/;

export function detectOccupations(text) {
  const n = normalize(text);
  return Object.entries(OCCUPATION_KEYWORDS)
    .filter(([, rx]) => rx.test(n))
    .map(([id]) => id);
}

export function mentionsOutOfScope(text) {
  return OUT_OF_SCOPE.test(normalize(text));
}
