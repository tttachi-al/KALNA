/**
 * Convierte el material original (`source/banco-preguntas-kallpa.txt`) en el
 * banco estructurado `bank.json`.
 *
 *   npm run assessment:import
 *
 * La clave de cada pregunta sale del marcador [CORRECTA] del material; nunca se
 * edita a mano. La competencia principal y la explicación vienen de
 * annotations.js. Las pruebas vuelven a analizar el material y comprueban que
 * bank.json coincide con él.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MODULE_OCCUPATIONS, QUESTION_ANNOTATIONS } from './annotations.js';

export const SOURCE_FILE = fileURLToPath(new URL('./source/banco-preguntas-kallpa.txt', import.meta.url));
export const BANK_FILE = fileURLToPath(new URL('./bank.json', import.meta.url));
const SOURCE_NAME = 'banco-preguntas-kallpa.txt';

/** Lee el material: módulos, preguntas numeradas y cinco alternativas A–E con una sola [CORRECTA]. */
export function parseSource(text) {
  const questions = [];
  let module = null;
  let current = null;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^MÓDULO \d+:\s*(.+)$/))) module = m[1].trim();
    else if (/^\(Evaluación:/.test(line)) continue;
    else if ((m = line.match(/^(\d+)\.\s+(.+)$/))) {
      current = { number: Number(m[1]), module, situation: m[2], options: [], correct: [] };
      questions.push(current);
    } else if ((m = line.match(/^([A-E])\)\s+(\[CORRECTA\]\s*)?(.+)$/)) && current) {
      current.options.push({ id: m[1], text: m[3].trim() });
      if (m[2]) current.correct.push(m[1]);
    } else throw new Error(`Línea no reconocida en el material: «${line.slice(0, 60)}»`);
  }
  for (const q of questions) {
    if (q.options.map((o) => o.id).join('') !== 'ABCDE') throw new Error(`La pregunta ${q.number} no tiene exactamente las alternativas A–E.`);
    if (q.correct.length !== 1) throw new Error(`La pregunta ${q.number} debe tener una sola alternativa [CORRECTA].`);
  }
  return questions;
}

export function buildBank(parsed) {
  return parsed.map((q) => {
    const occupationId = MODULE_OCCUPATIONS[q.module];
    const note = QUESTION_ANNOTATIONS[q.number];
    if (!occupationId) throw new Error(`Módulo sin puesto asignado: ${q.module}`);
    if (!note) throw new Error(`La pregunta ${q.number} no tiene competencia principal asignada.`);
    return {
      id: `${occupationId}-${String(q.number).padStart(2, '0')}`,
      occupationId,
      competencyKey: note.competency,
      situation: q.situation,
      options: q.options,
      correctOptionId: q.correct[0],
      explanation: note.explanation,
      validation: {
        status: 'validada',
        keySource: `Material proporcionado (${SOURCE_NAME}, pregunta ${q.number}, marcador [CORRECTA])`,
        competencyAssignment: 'Propuesta de KALLPA; pendiente de revisión experta',
        explanationSource: 'Redactada por KALLPA a partir de la alternativa correcta del material',
      },
    };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bank = buildBank(parseSource(readFileSync(SOURCE_FILE, 'utf8')));
  writeFileSync(BANK_FILE, `${JSON.stringify({ version: 1, source: SOURCE_NAME, questions: bank }, null, 2)}\n`);
  console.log(`bank.json: ${bank.length} preguntas.`);
}
