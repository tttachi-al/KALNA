import { ACTIONS, AREA_STATUS, AREAS, INTERPRETATION_TYPES, LIMITS, QUESTION_TYPES, SAID_CATEGORIES } from './guide.js';

/**
 * JSON Schemas de las dos tareas de cada turno. Se pasan a QVAC como
 * `responseFormat: { type: 'json_schema' }` (documentado para `completion()`
 * en @qvac/sdk 0.22.0), que los convierte en una gramática de llama.cpp.
 *
 *   NOTES_SCHEMA     → lo que se registra de la última respuesta (conclusiones)
 *   QUESTION_SCHEMA  → la siguiente pregunta (diálogo)
 *
 * Son dos llamadas separadas: un modelo pequeño cumple mejor una tarea
 * acotada, y así el diálogo y las conclusiones no se mezclan.
 * La gramática solo garantiza la forma; el contenido se valida en código.
 */
const str = (maxLength) => ({ type: 'string', maxLength });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const enumOf = (values) => ({ type: 'string', enum: values });

// `evidencias` va primero: el modelo decide si hubo un hecho concreto antes de copiar citas.
export const NOTES_SCHEMA = obj({
  evidencias: { type: 'array', maxItems: 2, items: obj({ cita: str(200), accion: str(160), resultado: str(160) }) },
  dijo: { type: 'array', maxItems: 4, items: obj({ categoria: enumOf(SAID_CATEGORIES), cita: str(200) }) },
  interpretaciones: { type: 'array', maxItems: 3, items: obj({ tipo: enumOf(INTERPRETATION_TYPES), texto: str(180), cita_base: str(200) }) },
  falta_saber: { type: 'array', maxItems: 5, items: str(140) },
  seguimiento: { type: 'array', maxItems: 3, items: str(140) },
  areas: obj(Object.fromEntries(AREAS.map((a) => [a, enumOf(AREA_STATUS)]))),
});

export const QUESTION_SCHEMA = obj({
  accion: enumOf(ACTIONS),
  area: enumOf(AREAS),
  tipo: enumOf(QUESTION_TYPES),
  motivo: str(200),
  detalle: str(120),
  pregunta: str(LIMITS.maxQuestionChars),
});

const format = (name, schema) => ({ type: 'json_schema', json_schema: { name, schema } });

export const NOTES_FORMAT = format('kallpa_notas_entrevista', NOTES_SCHEMA);
export const QUESTION_FORMAT = format('kallpa_pregunta_entrevista', QUESTION_SCHEMA);
