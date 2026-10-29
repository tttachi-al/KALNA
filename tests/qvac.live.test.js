// Pruebas con QVAC REAL (no simulado). Cargan el modelo con @qvac/sdk y
// ejecutan la entrevista adaptativa con seis perfiles distintos.
//
//   KALLPA_QVAC_LIVE=1 npm run test:qvac
//
// La primera vez descarga el modelo (QWEN3_4B_INST_Q4_K_M ≈ 2,5 GB) a ~/.qvac.
// Las respuestas de la PERSONA están guionadas; las preguntas las genera el modelo.
// La transcripción de cada perfil se imprime para revisión humana.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { createInterviewState, isLiteralQuote, userTextsOf } from '../server/interview/state.js';
import { runInterviewTurn } from '../server/interview/turn.js';
import { createQvacLlm } from '../server/qvac/llm.js';

const LIVE = process.env.KALLPA_QVAC_LIVE === '1';
const MODEL = process.env.KALLPA_LLM_MODEL || 'QWEN3_4B_INST_Q4_K_M';

const PROFILES = [
  {
    id: 'limpieza',
    expect: { evidence: true },
    profile: { experience: { occupations: ['limpieza'], formality: 'informal', duration: 'mas5' } },
    answers: [
      'Aprendí mirando a mi tía, ella limpiaba oficinas y me llevaba los sábados.',
      'Ahora limpio en una clínica. Ahí hay que desinfectar con otros productos y tener mucho cuidado.',
      'Una vez se derramó sangre en el pasillo y usé el protocolo: me puse guantes, aislé la zona y limpié con lejía diluida.',
      'Me lo enseñó la jefa de enfermeras cuando entré.',
    ],
  },
  {
    id: 'mercaderia_clientes',
    expect: { evidence: true },
    profile: { experience: { occupations: ['reponedor', 'vendedor'], formality: 'ambos', duration: '3a5' } },
    answers: [
      'Acomodo la mercadería y atiendo a la gente.',
      'Ayer llegó un camión de gaseosas y tuve que contar las cajas y ponerlas al fondo para sacar primero las que vencen antes.',
      'Si un cliente no encuentra algo, lo acompaño al pasillo o le ofrezco otra marca parecida.',
    ],
  },
  {
    id: 'horas_reducidas',
    profile: { experience: { occupations: ['cajero'], formality: 'informal', duration: '1a3' } },
    answers: [
      'Cobro en una bodega grande del mercado.',
      'Desde marzo me bajaron los turnos de seis a tres días.',
      'Empecé a vender comida los fines de semana para completar.',
    ],
  },
  {
    id: 'con_trabajo_busca_alternativas',
    profile: { experience: { occupations: ['administrativo'], formality: 'formal', duration: '3a5' } },
    answers: [
      'Trabajo en planilla en una distribuidora, registro facturas y archivo documentos. Estoy bien, pero quiero ver otras opciones.',
      'Me gustaría algo donde pueda crecer, porque llevo cuatro años haciendo lo mismo.',
      'Busco en grupos de Facebook y a veces me pasan avisos por WhatsApp.',
    ],
  },
  {
    id: 'ambigua_breve',
    profile: { experience: { occupations: ['vendedor'], formality: 'informal', duration: 'menos1' } },
    answers: ['no sé', 'de todo un poco', 'lo normal pues'],
  },
  {
    id: 'contradiccion',
    expect: { tension: true },
    profile: { experience: { occupations: ['vendedor'], formality: 'informal', duration: '3a5' } },
    answers: [
      'Trabajo en una tienda de ropa, pero la verdad no me gusta atender gente.',
      'Lo que más me piden es que atienda a los clientes difíciles porque yo los calmo.',
      'Les hablo bajito, los escucho y les busco una solución, como cambiar la prenda.',
    ],
  },
];

let llm;

before(async () => {
  if (!LIVE) return;
  llm = createQvacLlm({ modelName: MODEL, ctxSize: 8192, timeoutMs: 180000, log: (m) => console.log(`[qvac] ${m}`) });
  await llm.load();
});

after(async () => {
  if (llm) await llm.close();
});

for (const p of PROFILES) {
  test(`[QVAC real · ${MODEL}] entrevista adaptativa: ${p.id}`, { skip: !LIVE && 'define KALLPA_QVAC_LIVE=1 para usar QVAC real' }, async (t) => {
    let r = await runInterviewTurn({ state: createInterviewState(), profile: p.profile, userText: null, llm });
    const lines = [`ENTREVISTADOR (${r.origin}): ${r.question?.texto ?? ''}`];
    const turns = [r];
    for (const a of p.answers) {
      if (r.close) break;
      lines.push(`PERSONA: ${a}`);
      r = await runInterviewTurn({ state: r.state, profile: p.profile, userText: a, llm });
      lines.push(`ENTREVISTADOR (${r.origin}${r.question ? ` · ${r.question.area}/${r.question.accion} · detalle «${r.question.detalle}»` : ' · cierre'}): ${r.question?.texto ?? '(cierra)'}`);
      turns.push(r);
    }
    const s = r.state;
    lines.push(
      '— ESTADO —',
      `dijo: ${JSON.stringify(s.dijo.map((d) => `${d.categoria}: ${d.cita}`))}`,
      `evidencias: ${JSON.stringify(s.evidencias.map((e) => e.cita))}`,
      `interpretaciones (hipótesis): ${JSON.stringify(s.interpretaciones.map((i) => `${i.tipo}/${i.respaldo}: ${i.texto}`))}`,
      `falta_saber: ${JSON.stringify(s.falta_saber)}`,
      `areas: ${JSON.stringify(s.areas)}`,
      `rechazos de la pregunta por turno: ${JSON.stringify(s.log.map((l) => l.pregunta.filter((x) => x.rechazos.length).map((x) => `${x.rechazos.join('+')} ← ${x.accion}/«${x.detalle}» ${x.texto}`)))}`,
      `descartes de notas por turno: ${JSON.stringify(s.log.map((l) => (l.notas || []).flatMap((x) => (x.descartes || []).map((d) => d.why))))}`,
      `ms por turno: ${JSON.stringify(s.log.map((l) => l.ms))}`,
    );
    console.log(`\n===== ${p.id} =====\n${lines.join('\n')}\n`);
    t.diagnostic(`origen por turno: ${turns.map((x) => x.origin).join(', ')}`);

    // Lo que debe cumplirse con el modelo real:
    const fromModel = turns.filter((x) => x.origin === 'qvac').length;
    assert.ok(fromModel >= Math.ceil(turns.length * 0.6), `solo ${fromModel}/${turns.length} turnos vinieron del modelo; el resto usó la guía`);
    const asked = s.preguntas.map((q) => q.texto);
    assert.equal(new Set(asked).size, asked.length, 'no repite preguntas');
    for (const q of asked) assert.ok((q.match(/\?/g) || []).length <= 1, `más de una pregunta: ${q}`);
    if (p.expect?.evidence) assert.ok(s.evidencias.length >= 1, 'el relato concreto no quedó como evidencia');
    if (p.expect?.tension) {
      const noticed = s.interpretaciones.some((i) => i.tipo === 'tension') || s.preguntas.some((q) => q.accion === 'contrastar');
      assert.ok(noticed, 'no registró ni exploró la contradicción');
    }
    // Ninguna interpretación figura como hecho
    for (const i of s.interpretaciones) assert.equal(i.estado, 'hipotesis');
    // Toda cita registrada es literal (ya lo garantiza mergeNotes; se verifica de nuevo).
    for (const d of [...s.dijo, ...s.evidencias]) assert.ok(isLiteralQuote(d.cita, userTextsOf(s)), d.cita);
  });
}
