import { COMPETENCIES } from '../../src/data/competencies.js';

/**
 * Salida estructurada del análisis de competencias.
 *
 * Se pasa a QVAC como `responseFormat: { type: 'json_schema' }`, igual que
 * las tareas de la entrevista (documentado para `completion()` en
 * @qvac/sdk 0.22.0). El `enum` de `id` limita el modelo al catálogo. La
 * gramática solo garantiza la forma: estados, citas y niveles se validan en
 * código (validate.js).
 *
 * El modelo devuelve solo el id: el nombre y la descripción salen del
 * catálogo, para que no los invente.
 */
export const PROMPT_VERSION = 'v1';

export const STATUSES = ['evidencia', 'declarada', 'por_validar'];
export const QUOTE_TYPES = ['ejemplo_concreto', 'afirmacion', 'indicio'];
/** Escala provisional de nivel (ver server/prompts/competencies.v1.md). Por validar con el equipo. */
export const LEVELS = ['basico', 'intermedio', 'avanzado'];
const NO_LEVEL = 'sin_nivel';

export const LIMITS = { competencies: 10, quotesPerCompetency: 3, competenciesPerQuote: 3, missing: 5, quoteChars: 240 };

const str = (maxLength) => ({ type: 'string', maxLength });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const enumOf = (values) => ({ type: 'string', enum: values });

export const ANALYSIS_SCHEMA = obj({
  competencies: {
    type: 'array',
    maxItems: LIMITS.competencies,
    items: obj({
      id: enumOf(Object.keys(COMPETENCIES)),
      status: enumOf(STATUSES),
      evidence: { type: 'array', minItems: 1, maxItems: LIMITS.quotesPerCompetency, items: obj({ quote: str(LIMITS.quoteChars), type: enumOf(QUOTE_TYPES) }) },
      level: enumOf([NO_LEVEL, ...LEVELS]),
      level_reason: str(200),
    }),
  },
  missing_information: { type: 'array', maxItems: LIMITS.missing, items: str(160) },
});

export const ANALYSIS_FORMAT = { type: 'json_schema', json_schema: { name: 'kallpa_competencias', schema: ANALYSIS_SCHEMA } };
export { NO_LEVEL };
