import { createHash } from 'node:crypto';
import { COMPETENCIES, FAMILIES } from '../../src/data/competencies.js';
import { redact } from '../interview/state.js';

/**
 * Qué texto representa cada competencia antes de convertirlo en vector.
 *
 * - `text` es el texto LEGIBLE que se guarda junto al vector (para mostrarlo
 *   o auditarlo). Solo usa datos del catálogo y citas reales del perfil.
 * - `input` es lo que recibe el modelo: el texto con el prefijo de tarea que
 *   pide EmbeddingGemma (ficha de google/embeddinggemma-300m). El formato se
 *   guarda en `input_format` para no comparar vectores de formatos distintos.
 * - `hash` = sha256(modelo + formato + input): si no cambia, no se regenera.
 *
 * Formatos:
 *   documento (catálogo y, en el punto 4, ocupaciones):  title: {nombre} | text: {…}
 *   consulta  (competencia de una persona, con evidencia): task: search result | query: {…}
 */
export const INPUT_FORMATS = {
  documento: { id: 'retrieval_document', build: (title, text) => `title: ${title} | text: ${text}` },
  consulta: { id: 'retrieval_query', build: (_title, text) => `task: search result | query: ${text}` },
};

const MAX_QUOTES = 3;
const MAX_QUOTE_CHARS = 240;
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cut = (s, max) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(' ', max) > 0 ? s.lastIndexOf(' ', max) : max)}…`);

export const hashInput = (model, format, input) => createHash('sha256').update(`${model}\n${format}\n${input}`).digest('hex');

/** Representación de una competencia del catálogo (nombre, área y descripción). */
export function catalogCompetencyText(id) {
  const c = COMPETENCIES[id];
  if (!c) return null;
  const body = `${FAMILIES[c.family].name}. ${c.description}`;
  return { competencyId: id, textKind: 'descripcion', format: INPUT_FORMATS.documento.id, text: `${c.name}. ${body}`, input: INPUT_FORMATS.documento.build(c.name, body) };
}

/**
 * Todas las referencias de una competencia del catálogo, en formato documento:
 * descripción (chunk 0) + indicadores observables + ejemplos cotidianos
 * (server/catalog/competency-references.js). La similitud de una evidencia con
 * la competencia es la MÁXIMA entre estas referencias.
 */
export function catalogReferenceTexts(id, references) {
  const c = COMPETENCIES[id];
  if (!c) return [];
  const ref = references[id] || { indicators: [], examples: [] };
  const item = (textKind, chunk, text) => ({ competencyId: id, textKind, chunk, format: INPUT_FORMATS.documento.id, text, input: INPUT_FORMATS.documento.build(c.name, text) });
  return [
    { ...catalogCompetencyText(id), chunk: 0 },
    ...ref.indicators.map((t, i) => item('indicador', i, t)),
    ...ref.examples.map((t, i) => item('ejemplo', i, t)),
  ];
}

/**
 * Representación de un empleo: un vector general (nombre, descripción y
 * responsabilidades) y uno por TAREA. Las tareas van con `title: none` para
 * que el nombre del puesto no domine la similitud con lo que hizo la persona.
 */
export function occupationTexts(job) {
  const general = [job.description, job.responsibilities?.length ? `Responsabilidades: ${job.responsibilities.join('; ')}.` : ''].filter(Boolean).join(' ');
  return [
    { occupationId: job.id, textKind: 'descripcion', chunk: 0, format: INPUT_FORMATS.documento.id, text: `${job.name}. ${general}`, input: INPUT_FORMATS.documento.build(job.name, general) },
    ...job.tasks.map((t, i) => ({ occupationId: job.id, textKind: 'tareas', chunk: i, format: INPUT_FORMATS.documento.id, text: t, input: INPUT_FORMATS.documento.build('none', t) })),
  ];
}

/** Una evidencia (cita) de la persona como consulta, sin datos de contacto. */
export function evidenceText(quote) {
  const text = cut(clean(redact(quote)), MAX_QUOTE_CHARS);
  return text ? { format: INPUT_FORMATS.consulta.id, text, input: INPUT_FORMATS.consulta.build(null, text) } : null;
}

/**
 * Citas que dan contexto a una competencia del perfil: primero los ejemplos
 * fuertes, luego las demás evidencias. Sin repetir y sin datos de contacto.
 */
export function selectEvidence(evidence = []) {
  const rank = (e) => (e.kind === 'ejemplo' && e.quality === 'fuerte' ? 0 : e.origin === 'qvac' ? 1 : e.kind === 'ejemplo' ? 2 : 3);
  const seen = new Set();
  const out = [];
  for (const e of [...evidence].sort((a, b) => rank(a) - rank(b))) {
    const q = cut(clean(redact(e.quote)), MAX_QUOTE_CHARS);
    const key = q.toLowerCase();
    if (!q || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= MAX_QUOTES) break;
  }
  return out;
}

/**
 * Representación de una competencia de un perfil guardado
 * (`profiles.load()`): nombre y descripción del catálogo + hasta tres citas
 * de la persona como contexto. Devuelve null si la competencia no existe.
 */
export function profileCompetencyText(competency) {
  const c = COMPETENCIES[competency?.id];
  if (!c) return null;
  const quotes = selectEvidence(competency.evidence);
  const base = `${c.name}: ${c.description}`;
  const text = quotes.length ? `${base} Evidencia de la persona: ${quotes.map((q) => `«${q}»`).join(' ')}` : base;
  return { competencyId: c.id, format: INPUT_FORMATS.consulta.id, text, evidenceCount: quotes.length, input: INPUT_FORMATS.consulta.build(c.name, text) };
}
