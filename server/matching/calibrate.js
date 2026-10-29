/**
 * Calibración de umbrales con QVAC Text Embeddings REAL y PostgreSQL.
 *
 *   npm run matching:calibrate
 *
 * Mide sobre server/matching/calibration-cases.js:
 *  1. Evidencia → competencia: acierto top-1 / top-3 y la distribución de la
 *     similitud máxima en positivos, negativos y ambiguos (umbral de candidata).
 *  2. Competencia ↔ competencia: similitud de centroides en pares `bases`
 *     (transferencia curada) frente a pares sin relación (umbral de transferencia).
 *  3. Evidencia → tarea de empleo: si algún empleo pertinente aparece entre los
 *     5 primeros y la similitud de la mejor tarea (umbral de tarea).
 *
 * No escribe nada: imprime las métricas y los umbrales sugeridos.
 */
import { close as closeQvac } from '@qvac/sdk';
import { COMPETENCIES } from '../../src/data/competencies.js';
import { createPool } from '../db/pool.js';
import { createQvacEmbedder } from '../qvac/embeddings.js';
import { AMBIGUOUS, JOB_CASES, NEGATIVES, POSITIVES, TRANSFER_NEGATIVES } from './calibration-cases.js';
import { createSemanticIndex } from './semantic.js';

const fmt = (x) => x.toFixed(3);
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0], p25: s[Math.floor(s.length * 0.25)], med: s[Math.floor(s.length / 2)], max: s.at(-1) };
};
const show = (name, xs) => {
  const s = stats(xs);
  console.log(`  ${name.padEnd(12)} n=${String(xs.length).padStart(2)}  min ${fmt(s.min)}  p25 ${fmt(s.p25)}  med ${fmt(s.med)}  max ${fmt(s.max)}`);
};

export async function calibrate({ pool, embedder, verbose = true }) {
  const sem = createSemanticIndex({ pool, embedder });
  const out = { positives: [], negatives: [], ambiguous: [] };

  // 1. Evidencia → competencia
  const all = [...POSITIVES.map((p) => p.text), ...NEGATIVES, ...AMBIGUOUS];
  const vectors = await sem.embedEvidence(all);
  const byText = new Map(vectors.map((v) => [v.text, v.vector]));
  let top1 = 0;
  let top3 = 0;
  for (const p of POSITIVES) {
    const scores = await sem.competencyScores(byText.get(p.text));
    const rank = scores.findIndex((s) => p.expected.includes(s.competencyId));
    if (rank === 0) top1 += 1;
    if (rank >= 0 && rank < 3) top3 += 1;
    out.positives.push({ text: p.text, top: scores[0], best: scores[rank], rank, margin: scores[0].similarity - scores[1].similarity });
    if (verbose && rank !== 0) console.log(`  · «${p.text.slice(0, 60)}…» esperado ${p.expected.join('/')}, rango ${rank + 1}, top ${scores[0].competencyId} ${fmt(scores[0].similarity)}`);
  }
  for (const [list, key] of [[NEGATIVES, 'negatives'], [AMBIGUOUS, 'ambiguous']]) {
    for (const t of list) {
      const scores = await sem.competencyScores(byText.get(t));
      out[key].push({ text: t, top: scores[0], margin: scores[0].similarity - scores[1].similarity });
    }
  }
  const posTop = out.positives.map((p) => p.top.similarity);
  const posBest = out.positives.filter((p) => p.rank >= 0 && p.rank < 3).map((p) => p.best.similarity);
  const negTop = out.negatives.map((n) => n.top.similarity);
  const ambTop = out.ambiguous.map((n) => n.top.similarity);
  // Umbral de candidata: el que mejor separa la competencia correcta (top-3) de los negativos.
  let bestTau = null;
  for (let tau = 0.4; tau <= 0.8; tau += 0.005) {
    const tp = posBest.filter((x) => x >= tau).length;
    const fp = negTop.filter((x) => x >= tau).length;
    const fn = POSITIVES.length - tp;
    const f1 = (2 * tp) / (2 * tp + fp + fn);
    if (!bestTau || f1 > bestTau.f1 + 1e-9) bestTau = { tau: Number(tau.toFixed(3)), f1, tp, fp };
  }

  // 2. Competencia ↔ competencia
  const sim = await sem.competencySimilarity();
  const basesPairs = Object.values(COMPETENCIES).flatMap((c) => c.bases.map((b) => [b.id, c.id]));
  const basesSims = basesPairs.map(([a, b]) => sim.get(a).get(b));
  const negSims = TRANSFER_NEGATIVES.map(([a, b]) => sim.get(a).get(b));
  const allPairs = [...sim.entries()].flatMap(([a, m]) => [...m.entries()].filter(([b]) => a < b).map(([, s]) => s));

  // 3. Evidencia → tareas de empleos
  const jobResults = [];
  for (const c of JOB_CASES) {
    const v = byText.get(c.text) || (await sem.embedEvidence([c.text]))[0].vector;
    const tasks = await sem.taskMatches(v, { minSimilarity: -1, limit: 50 });
    const rank = tasks.findIndex((t) => c.expected.includes(t.occupationId));
    jobResults.push({ text: c.text, rank, top: tasks[0], best: tasks[rank] });
  }
  const negTask = [];
  for (const t of NEGATIVES) {
    const tasks = await sem.taskMatches(byText.get(t), { minSimilarity: -1, limit: 1 });
    negTask.push(tasks[0].similarity);
  }
  const jobBest = jobResults.filter((j) => j.rank >= 0 && j.rank < 5).map((j) => j.best.similarity);

  const report = {
    model: (await sem.modelKey()).model,
    competency: { top1: top1 / POSITIVES.length, top3: top3 / POSITIVES.length, tauCandidate: bestTau },
    sims: { posTop, posBest, negTop, ambTop, basesSims, negSims, allPairs, jobBest, negTask },
    jobs: { top5: jobResults.filter((j) => j.rank >= 0 && j.rank < 5).length / JOB_CASES.length, results: jobResults },
    details: out,
  };
  if (verbose) {
    console.log(`\nModelo ${report.model}`);
    console.log(`Evidencia → competencia: top-1 ${top1}/${POSITIVES.length} · top-3 ${top3}/${POSITIVES.length}`);
    show('positivos*', posBest);
    show('negativos', negTop);
    show('ambiguos', ambTop);
    console.log(`  umbral de candidata sugerido ${bestTau.tau} (F1 ${fmt(bestTau.f1)}, ${bestTau.tp} positivos y ${bestTau.fp} negativos por encima)`);
    console.log('Competencia ↔ competencia (centroides):');
    show('bases', basesSims);
    show('sin relación', negSims);
    show('todos', allPairs);
    console.log(`Evidencia → tareas: algún empleo pertinente en el top-5 en ${jobResults.filter((j) => j.rank >= 0 && j.rank < 5).length}/${JOB_CASES.length}`);
    for (const j of jobResults) console.log(`  · rango ${j.rank + 1} · mejor ${j.top.occupationId} ${fmt(j.top.similarity)} · «${j.text.slice(0, 50)}…»`);
    show('tarea ok', jobBest);
    show('tarea neg', negTask);
  }
  return report;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const pool = createPool(process.env.DATABASE_URL);
  const embedder = createQvacEmbedder({ modelName: process.env.KALLPA_EMBED_MODEL || 'EMBEDDINGGEMMA_300M_Q8_0' });
  try {
    await calibrate({ pool, embedder });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await embedder.close().catch(() => {});
    await closeQvac().catch(() => {});
    await pool.end();
  }
}
