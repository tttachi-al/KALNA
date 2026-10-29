import { COMPETENCIES } from '../../data/competencies.js';
import { OCCUPATIONS, OCCUPATION_IDS } from '../../data/occupations.js';
import { evaluateEvidence, EVIDENCE_TIPS } from './evidence.js';
import { detectOccupations, extractCompetencies, mentionsOutOfScope } from './extractor.js';
import { addExample, addMention, createEmptyProfile, statusCounts } from './profile.js';
import { cleanAlias, joinNames, uid } from './text.js';

/**
 * Máquina de estados de la conversación de diagnóstico (motor de demostración).
 *
 * Etapas: bienvenida → nombre → ocupaciones → formalidad → tiempo → tareas
 *         → herramientas → responsabilidades → situaciones → (ampliar)
 *         → evidencia (bucle) → fin
 *
 * El contrato de entrada/salida es el mismo que usará QVAC:
 *   startSession()            → session
 *   advance(session, input)   → { session, messages }   (messages = nuevos mensajes del bot)
 *   describeStage(session)    → UI de la etapa actual (opciones, ayuda, progreso)
 */

export const MAX_EVIDENCE_QUESTIONS = 4;

const FORMALITY = [
  { id: 'formal', label: 'Formal (con contrato)' },
  { id: 'informal', label: 'Informal (sin contrato)' },
  { id: 'ambos', label: 'Ambos' },
];
const DURATION = [
  { id: 'menos1', label: 'Menos de 1 año' },
  { id: '1a3', label: 'De 1 a 3 años' },
  { id: '3a5', label: 'De 3 a 5 años' },
  { id: 'mas5', label: 'Más de 5 años' },
];
export const FORMALITY_LABELS = Object.fromEntries(FORMALITY.map((f) => [f.id, f.label]));
/** Etiquetas para mostrar el tipo de experiencia en el perfil y el pasaporte. */
export const FORMALITY_DISPLAY = {
  formal: 'Formal (con contrato)',
  informal: 'Informal (sin contrato)',
  ambos: 'Formal e informal',
};
export const DURATION_LABELS = Object.fromEntries(DURATION.map((d) => [d.id, d.label]));

const TASK_HINTS = {
  limpieza: 'qué áreas limpiabas, cómo preparabas tus materiales o qué hacías al terminar',
  administrativo: 'qué documentos ordenabas, qué datos registrabas o con quién coordinabas',
  reponedor: 'cómo reponías los estantes, si contabas productos o recibías mercadería',
  vendedor: 'cómo atendías a los clientes, qué vendías o cómo tomabas pedidos',
  cajero: 'cómo cobrabas, cómo dabas el vuelto o cómo cerrabas la caja',
};

const TOOL_SUGGESTIONS = {
  limpieza: [
    'Productos de limpieza',
    'Guantes y mascarilla',
    'Carrito de limpieza',
    'Lista de verificación',
  ],
  administrativo: ['Computadora', 'Excel', 'Correo electrónico', 'WhatsApp', 'Impresora y escáner'],
  reponedor: ['Hoja de inventario', 'Lector de códigos', 'Carretilla', 'Guía de remisión'],
  vendedor: ['Cuaderno de pedidos', 'WhatsApp', 'Catálogo', 'Vitrina'],
  cajero: ['Caja registradora', 'POS', 'Yape o Plin', 'Calculadora', 'Boletas'],
};

const STEPS = [
  {
    id: 'experiencia',
    label: 'Tu experiencia',
    stages: ['nombre', 'ocupaciones', 'formalidad', 'tiempo'],
  },
  { id: 'tareas', label: 'Tus tareas', stages: ['tareas', 'ampliar'] },
  { id: 'herramientas', label: 'Herramientas', stages: ['herramientas'] },
  { id: 'responsabilidades', label: 'Responsabilidades', stages: ['responsabilidades'] },
  { id: 'situaciones', label: 'Situaciones', stages: ['situaciones'] },
  { id: 'evidencia', label: 'Ejemplos', stages: ['evidencia'] },
];

const bot = (text, kind = 'text', data) => ({
  id: uid('m'),
  role: 'bot',
  text,
  kind,
  data,
  at: Date.now(),
});
const user = (text) => ({ id: uid('m'), role: 'user', text, kind: 'text', at: Date.now() });

const occNames = (ids) => joinNames(ids.map((id) => OCCUPATIONS[id].name.toLowerCase()));

/* ─────────────────────────── Inicio ─────────────────────────── */

export function startSession() {
  const messages = [
    bot(
      '¡Hola! Soy el asistente de Kalna. Te haré algunas preguntas sobre tu experiencia de trabajo para ayudarte a reconocer lo que ya sabes hacer.',
    ),
    bot(
      'Kalna trabaja con cinco ocupaciones: personal de limpieza, auxiliar administrativo, reponedor y abastecedor, vendedor de tienda y cajero.',
      'scope',
    ),
    bot(
      'Responde con tus palabras: no hay respuestas buenas ni malas. Para cuidar tu privacidad, no escribas tu DNI, dirección ni teléfono.',
      'privacy',
    ),
  ];
  return {
    id: uid('s'),
    version: 1,
    stage: 'bienvenida',
    messages,
    profile: createEmptyProfile(),
    queue: [],
    queueIndex: 0,
    retries: {},
    done: false,
    startedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────── Preguntas ─────────────────────────── */

function questionFor(session) {
  const { stage, profile } = session;
  const occs = profile.experience.occupations;
  switch (stage) {
    case 'nombre':
      return bot('¿Cómo quieres que te llame? Puedes usar un apodo.');
    case 'ocupaciones':
      return bot(
        '¿En cuál de estos trabajos tienes experiencia? Puedes elegir más de uno. Vale la experiencia formal o informal.',
      );
    case 'formalidad':
      return bot(
        `¿Tu experiencia como ${occNames(occs)} fue formal (con contrato) o informal (sin contrato)? Las dos valen igual en Kalna.`,
      );
    case 'tiempo':
      return bot('¿Cuánto tiempo de experiencia tienes en total?');
    case 'tareas':
      return bot(
        `Cuéntame qué hacías en un día normal de trabajo. Por ejemplo: ${occs.map((o) => TASK_HINTS[o]).join('; o ')}.`,
      );
    case 'ampliar':
      return bot(
        'Cuéntame con más detalle una tarea que hacías seguido: qué hacías, con qué materiales y con qué personas.',
      );
    case 'herramientas':
      return bot(
        '¿Qué herramientas, equipos, productos o aplicaciones usabas? Puedes tocar las opciones o escribir.',
      );
    case 'responsabilidades':
      return bot(
        '¿De qué cosas eras responsable? Por ejemplo: llaves, dinero, pedidos, el orden de un área o enseñar a compañeros nuevos.',
      );
    case 'situaciones':
      return bot(
        'Cuéntame una situación difícil que resolviste en el trabajo. ¿Qué pasó y qué hiciste?',
      );
    case 'evidencia': {
      const id = session.queue[session.queueIndex];
      const c = COMPETENCIES[id];
      return bot(`Sobre «${c.name}»: ${c.ask}`, 'ask-evidence', {
        competencyId: id,
        index: session.queueIndex,
        total: session.queue.length,
      });
    }
    default:
      return null;
  }
}

/* ─────────────────────────── Avance ─────────────────────────── */

function moveTo(session, stage, extra = []) {
  const next = { ...session, stage };
  const q = questionFor(next);
  return { session: next, messages: q ? [...extra, q] : extra };
}

export function registerFindings(session, text, source) {
  let profile = session.profile;
  const found = extractCompetencies(text);
  const fresh = [];
  for (const f of found) {
    const r = addMention(profile, f.id, f.quote, source);
    profile = r.profile;
    if (r.isNew) fresh.push(f.id);
  }
  return { session: { ...session, profile }, fresh, found: found.map((f) => f.id) };
}

function findingsMessage(fresh, source, found = []) {
  if (!fresh.length) {
    if (found.length) {
      const names = found.map((id) => COMPETENCIES[id].name);
      return bot(`Gracias. Lo que cuentas refuerza: ${joinNames(names)}.`, 'reinforce', {
        ids: found,
        source,
      });
    }
    return bot(
      'Gracias. En esta respuesta no encontré competencias nuevas, pero la tengo en cuenta.',
    );
  }
  const names = fresh.map((id) => COMPETENCIES[id].name);
  const label =
    source === 'herramientas' ? 'Posibles competencias (por validar)' : 'Posibles competencias';
  return bot(`${label}: ${joinNames(names)}.`, 'findings', { ids: fresh, source });
}

/** Elige las competencias más útiles para pedir un ejemplo. */
export function prioritizeForEvidence(profile, max = MAX_EVIDENCE_QUESTIONS) {
  const own = profile.experience.occupations;
  return Object.values(profile.competencies)
    .filter((c) => c.status !== 'evidencia')
    .map((c) => {
      let score = 0;
      const requiredBy = OCCUPATION_IDS.filter((o) =>
        OCCUPATIONS[o].requires.some((r) => r.id === c.id),
      );
      if (requiredBy.some((o) => own.includes(o))) score += 3;
      score += requiredBy.filter((o) => !own.includes(o)).length;
      score += Math.min(c.mentions.length, 3) * 0.5;
      if (c.status === 'por_validar') score += 0.25;
      return { id: c.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.id);
}

function startEvidence(session) {
  const queue = prioritizeForEvidence(session.profile);
  const total = Object.keys(session.profile.competencies).length;
  if (!queue.length) return finish({ ...session, queue: [] });
  const intro = bot(
    `Identifiqué ${total} posible${total === 1 ? '' : 's'} competencia${total === 1 ? '' : 's'}. Por ahora se basan en lo que contaste. Para respaldarlas, te pediré un ejemplo concreto de ${queue.length === 1 ? 'una' : `${queue.length}`}. Si no recuerdas alguno, puedes omitirlo.`,
    'summary',
    { ids: Object.keys(session.profile.competencies) },
  );
  return moveTo({ ...session, queue, queueIndex: 0 }, 'evidencia', [intro]);
}

function finish(session) {
  const counts = statusCounts(session.profile);
  const name = session.profile.alias ? `, ${session.profile.alias}` : '';
  const msgs = [];
  if (!counts.total) {
    msgs.push(
      bot(
        `Gracias${name}. Con lo que me contaste todavía no pude reconocer competencias. Puedes volver a intentarlo con más detalles o explorar las ocupaciones para conocer qué se necesita en cada una.`,
        'result',
        { counts },
      ),
    );
  } else {
    msgs.push(
      bot(
        `Listo${name}. Armé tu perfil: ${counts.evidencia} con evidencia, ${counts.declarada} declarada${counts.declarada === 1 ? '' : 's'} y ${counts.por_validar} por validar. Ninguna competencia está certificada: son un punto de partida para reconocerlas, respaldarlas y aprovecharlas.`,
        'result',
        { counts },
      ),
    );
  }
  return {
    session: { ...session, stage: 'fin', done: true, finishedAt: new Date().toISOString() },
    messages: msgs,
  };
}

/**
 * Avanza la conversación con la respuesta de la persona.
 * @param {object} session
 * @param {{text?: string, choices?: string[], skip?: boolean}} input
 */
export function advance(session, input = {}) {
  const text = (input.text || '').trim();
  const choices = input.choices || [];
  const skip = Boolean(input.skip);
  const s = { ...session };

  switch (s.stage) {
    case 'bienvenida': {
      if (choices.includes('como')) {
        const explain = [
          user('¿Cómo funciona?'),
          bot(
            'Primero te pregunto por tu experiencia. Luego reconozco posibles competencias en lo que cuentas y te pido ejemplos para respaldarlas.',
          ),
          bot(
            'Cada competencia tendrá un estado: «Con evidencia» si diste un ejemplo concreto, «Declarada» si la mencionaste y «Por validar» si solo hay un indicio. Nada de esto es una certificación.',
            'legend',
          ),
        ];
        return {
          session: { ...s, messages: [...s.messages, ...explain] },
          messages: explain.slice(1),
        };
      }
      const u = user('Empezar');
      const r = moveTo({ ...s, messages: [...s.messages, u] }, 'nombre');
      return withMessages(r);
    }

    case 'nombre': {
      const alias = skip ? '' : cleanAlias(text);
      const u = user(skip ? 'Prefiero no decirlo' : text);
      const profile = { ...s.profile, alias };
      const greet = bot(alias ? `Mucho gusto, ${alias}.` : 'Está bien, no hace falta.');
      return withMessages(
        moveTo({ ...s, profile, messages: [...s.messages, u] }, 'ocupaciones', [greet]),
      );
    }

    case 'ocupaciones': {
      let occs = choices.filter((c) => OCCUPATION_IDS.includes(c));
      const shown = occs.length ? occNames(occs) : text;
      if (!occs.length && text) occs = detectOccupations(text);
      const u = user(shown ? capitalize(shown) : '—');
      if (!occs.length) {
        const reply = mentionsOutOfScope(text)
          ? bot(
              'Gracias por contarme. Por ahora Kalna solo trabaja con estas cinco ocupaciones. Si en algún trabajo hiciste tareas parecidas a alguna de ellas, elígela.',
              'scope',
            )
          : bot('No logré reconocer la ocupación. Elige una o más de las opciones, por favor.');
        return withMessages({ session: { ...s, messages: [...s.messages, u] }, messages: [reply] });
      }
      const profile = { ...s.profile, experience: { ...s.profile.experience, occupations: occs } };
      const ack = bot(`Anotado: ${occNames(occs)}.`);
      return withMessages(
        moveTo({ ...s, profile, messages: [...s.messages, u] }, 'formalidad', [ack]),
      );
    }

    case 'formalidad': {
      const f = choices.find((c) => FORMALITY_LABELS[c]) || guessFormality(text);
      if (!f)
        return withMessages({
          session: s,
          messages: [bot('Elige una opción: formal, informal o ambos.')],
        });
      const u = user(FORMALITY_LABELS[f]);
      const profile = { ...s.profile, experience: { ...s.profile.experience, formality: f } };
      return withMessages(moveTo({ ...s, profile, messages: [...s.messages, u] }, 'tiempo'));
    }

    case 'tiempo': {
      const d = choices.find((c) => DURATION_LABELS[c]) || guessDuration(text);
      if (!d)
        return withMessages({
          session: s,
          messages: [bot('Elige el tiempo que más se acerque a tu experiencia.')],
        });
      const u = user(DURATION_LABELS[d]);
      const profile = { ...s.profile, experience: { ...s.profile.experience, duration: d } };
      const note = bot(
        'Gracias. Ahora cuéntame de tu trabajo. No asumo que tienes una competencia solo por tu ocupación: la reconozco a partir de lo que me cuentes.',
        'principle',
      );
      return withMessages(
        moveTo({ ...s, profile, messages: [...s.messages, u] }, 'tareas', [note]),
      );
    }

    case 'tareas':
    case 'herramientas':
    case 'responsabilidades':
    case 'situaciones':
    case 'ampliar': {
      const stage = s.stage;
      const combined = [text, ...choices].filter(Boolean).join('. ');
      if (skip && stage !== 'tareas') {
        const u = user('Prefiero pasar a la siguiente pregunta');
        return withMessages(nextAfterOpen({ ...s, messages: [...s.messages, u] }, stage, []));
      }
      if (!combined)
        return withMessages({
          session: s,
          messages: [bot('Escribe tu respuesta con tus palabras. Puede ser corta.')],
        });
      const u = user(combined);
      const answers = {
        ...s.profile.answers,
        [stage]: [s.profile.answers[stage], combined].filter(Boolean).join(' '),
      };
      let next = { ...s, profile: { ...s.profile, answers }, messages: [...s.messages, u] };
      const source = stage === 'ampliar' ? 'tareas' : stage;
      const r = registerFindings(next, combined, source);
      next = r.session;

      // Si en "tareas" no aparece nada, pedimos una vez más detalle.
      if (stage === 'tareas' && !r.found.length && !s.retries.tareas) {
        const ask = bot(
          'Gracias. Para entenderte mejor, cuéntame un poco más: ¿qué hacías con tus manos, con qué materiales o con qué personas trabajabas?',
        );
        return withMessages({
          session: { ...next, retries: { ...next.retries, tareas: 1 } },
          messages: [ask],
        });
      }
      return withMessages(nextAfterOpen(next, stage, [findingsMessage(r.fresh, source, r.found)]));
    }

    case 'evidencia': {
      const id = s.queue[s.queueIndex];
      const c = COMPETENCIES[id];
      let next = { ...s };
      const out = [];
      if (skip || !text) {
        next.messages = [...s.messages, user('Omitir por ahora')];
        out.push(
          bot(
            `Está bien. «${c.name}» queda como «${labelFor(next.profile, id)}». Podrás agregar un ejemplo después desde tu perfil.`,
          ),
        );
      } else {
        next.messages = [...s.messages, user(text)];
        const { profile, level, mismatch } = addExample(next.profile, id, text);
        next.profile = profile;
        if (mismatch) {
          out.push(
            bot(
              `Gracias. Este ejemplo parece hablar más de «${COMPETENCIES[mismatch].name}». Para respaldar «${c.name}», ayuda un ejemplo de esa tarea en particular. Por ahora la dejo como «${labelFor(next.profile, id)}»; podrás completarla en tu perfil.`,
              'evidence-partial',
              { competencyId: id },
            ),
          );
        } else if (level === 'fuerte') {
          out.push(
            bot(
              `¡Gracias! Este ejemplo respalda «${c.name}». Ahora figura «Con evidencia».`,
              'evidence-ok',
              { competencyId: id },
            ),
          );
        } else {
          out.push(
            bot(
              `Gracias. Para que el ejemplo la respalde, ayudan detalles como: ${EVIDENCE_TIPS.join(', ').toLowerCase()}. La dejo como «${labelFor(next.profile, id)}»; podrás completarla en tu perfil.`,
              'evidence-partial',
              { competencyId: id },
            ),
          );
        }
        // Un ejemplo también puede revelar otras competencias.
        const r = registerFindings(next, text, 'evidencia');
        next = r.session;
        if (r.fresh.length) out.push(findingsMessage(r.fresh, 'evidencia'));
      }
      const qi = s.queueIndex + 1;
      if (qi < s.queue.length)
        return withMessages(moveTo({ ...next, queueIndex: qi }, 'evidencia', out));
      const f = finish({ ...next, queueIndex: qi });
      return withMessages({ session: f.session, messages: [...out, ...f.messages] });
    }

    default:
      return { session: s, messages: [] };
  }
}

function nextAfterOpen(session, stage, extra) {
  const order = ['tareas', 'herramientas', 'responsabilidades', 'situaciones'];
  if (stage === 'ampliar') return startEvidenceOrEmpty(session, extra);
  const i = order.indexOf(stage);
  if (i < order.length - 1) return moveTo(session, order[i + 1], extra);
  // Fin de preguntas abiertas
  if (!Object.keys(session.profile.competencies).length && !session.retries.ampliar) {
    return moveTo({ ...session, retries: { ...session.retries, ampliar: 1 } }, 'ampliar', extra);
  }
  return startEvidenceOrEmpty(session, extra);
}

export function startEvidenceOrEmpty(session, extra) {
  const r = Object.keys(session.profile.competencies).length
    ? startEvidence(session)
    : finish(session);
  return { session: r.session, messages: [...extra, ...r.messages] };
}

/** Agrega los mensajes del bot a la sesión y los devuelve por separado. */
export function withMessages({ session, messages }) {
  return { session: { ...session, messages: [...session.messages, ...messages] }, messages };
}

function labelFor(profile, id) {
  const st = profile.competencies[id]?.status;
  return st === 'evidencia' ? 'Con evidencia' : st === 'declarada' ? 'Declarada' : 'Por validar';
}

function capitalize(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function guessFormality(text) {
  const t = text.toLowerCase();
  if (/ambos|las dos|los dos/.test(t)) return 'ambos';
  if (/informal|sin contrato/.test(t)) return 'informal';
  if (/formal|contrato|planilla/.test(t)) return 'formal';
  return null;
}

function guessDuration(text) {
  const n = parseInt((text.match(/\d+/) || [])[0], 10);
  if (/mes/.test(text) || n === 0) return 'menos1';
  if (Number.isNaN(n)) return null;
  if (n < 1) return 'menos1';
  if (n <= 3) return '1a3';
  if (n <= 5) return '3a5';
  return 'mas5';
}

/* ─────────────────────────── UI de cada etapa ─────────────────────────── */

export function describeStage(session) {
  const { stage, profile } = session;
  const stepIndex = STEPS.findIndex((st) => st.stages.includes(stage));
  const progress = {
    steps: STEPS.map((st) => ({ id: st.id, label: st.label })),
    current: stage === 'fin' ? STEPS.length : Math.max(stepIndex, 0),
    total: STEPS.length,
    started: stage !== 'bienvenida',
  };
  const base = {
    stage,
    progress,
    input: 'text',
    choices: [],
    multi: false,
    suggestions: [],
    allowSkip: false,
    skipLabel: 'Omitir',
    placeholder: 'Escribe tu respuesta…',
    hint: null,
    actions: [],
  };

  switch (stage) {
    case 'bienvenida':
      return {
        ...base,
        input: 'choices',
        choices: [
          { id: 'empezar', label: 'Empezar' },
          { id: 'como', label: '¿Cómo funciona?' },
        ],
      };
    case 'nombre':
      return {
        ...base,
        allowSkip: true,
        skipLabel: 'Prefiero no decirlo',
        placeholder: 'Tu nombre o apodo',
      };
    case 'ocupaciones':
      return {
        ...base,
        input: 'choices+text',
        multi: true,
        choices: OCCUPATION_IDS.map((id) => ({ id, label: OCCUPATIONS[id].name, icon: id })),
        placeholder: 'O escríbelo con tus palabras…',
        hint: 'Solo trabajamos con estas cinco ocupaciones.',
      };
    case 'formalidad':
      return { ...base, input: 'choices', choices: FORMALITY };
    case 'tiempo':
      return { ...base, input: 'choices', choices: DURATION };
    case 'tareas':
      return {
        ...base,
        placeholder: 'Ej.: Cada mañana preparaba mis materiales y…',
        hint: 'Puedes escribir o usar el micrófono.',
      };
    case 'ampliar':
      return {
        ...base,
        allowSkip: true,
        skipLabel: 'Pasar esta pregunta',
        placeholder: 'Cuéntame una tarea con detalle…',
      };
    case 'herramientas': {
      const sugg = [
        ...new Set(profile.experience.occupations.flatMap((o) => TOOL_SUGGESTIONS[o] || [])),
      ];
      return {
        ...base,
        suggestions: sugg.map((label) => ({ id: label, label })),
        allowSkip: true,
        skipLabel: 'Pasar esta pregunta',
        placeholder: 'Ej.: Usaba guantes, desinfectante y WhatsApp…',
      };
    }
    case 'responsabilidades':
      return {
        ...base,
        allowSkip: true,
        skipLabel: 'Pasar esta pregunta',
        placeholder: 'Ej.: Era responsable de las llaves y…',
      };
    case 'situaciones':
      return {
        ...base,
        allowSkip: true,
        skipLabel: 'Pasar esta pregunta',
        placeholder: 'Ej.: Una vez faltó un producto y yo…',
      };
    case 'evidencia': {
      const id = session.queue[session.queueIndex];
      return {
        ...base,
        allowSkip: true,
        skipLabel: 'Omitir por ahora',
        placeholder: 'Cuenta un ejemplo concreto…',
        hint: `Ejemplo ${session.queueIndex + 1} de ${session.queue.length} · Ayuda contar: ${EVIDENCE_TIPS.join(', ').toLowerCase()}.`,
        competencyId: id,
      };
    }
    case 'fin':
      return {
        ...base,
        input: 'none',
        // Sin competencias reconocidas no hay perfil ni puestos que mostrar: se ofrece empezar de nuevo.
        actions: statusCounts(profile).total
          ? [
              { id: 'perfil', label: 'Ver mi perfil', to: '/perfil', primary: true },
              { id: 'ocupaciones', label: 'Ver puestos recomendados', to: '/ocupaciones' },
            ]
          : [{ id: 'reiniciar', label: 'Empezar de nuevo', restart: true, primary: true }],
      };
    default:
      return base;
  }
}

export { evaluateEvidence };
