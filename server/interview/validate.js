import { normalize } from '../../src/services/engine/text.js';
import { ACTIONS, AREA_STATUS, AREAS, LIMITS, QUESTION_TYPES } from './guide.js';
import { comparable, isLiteralQuote } from './state.js';

/**
 * Validación de la salida del modelo ANTES de usarla o mostrarla.
 * La gramática de QVAC asegura un JSON con la forma del esquema; aquí se
 * vuelve a comprobar la forma y se revisa el contenido según el taller.
 */

function parseJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { error: 'respuesta_vacia' };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    // Algunos modelos envuelven el JSON en texto: se toma el primer objeto completo.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return { value: JSON.parse(raw.slice(start, end + 1)) };
      } catch {
        /* sigue abajo */
      }
    }
    return { error: 'json_invalido' };
  }
}

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function notesShapeError(v) {
  if (!isObject(v)) return 'no_es_objeto';
  for (const k of ['dijo', 'evidencias', 'interpretaciones', 'falta_saber', 'seguimiento']) {
    if (!Array.isArray(v[k])) return `campo_${k}_invalido`;
  }
  if (!isObject(v.areas)) return 'campo_areas_invalido';
  for (const a of AREAS) if (!AREA_STATUS.includes(v.areas[a])) return `area_${a}_invalida`;
  return null;
}

function questionShapeError(v) {
  if (!isObject(v)) return 'no_es_objeto';
  if (!ACTIONS.includes(v.accion) || !AREAS.includes(v.area) || !QUESTION_TYPES.includes(v.tipo)) return 'campo_decision_invalido';
  if (typeof v.pregunta !== 'string' || typeof v.detalle !== 'string') return 'campo_texto_invalido';
  return null;
}

const parseWith = (shapeError) => (text) => {
  const { value, error } = parseJson(text);
  if (error) return { ok: false, error };
  const bad = shapeError(value);
  return bad ? { ok: false, error: bad } : { ok: true, value };
};

/** Notas de la última respuesta (dijo, evidencias, interpretaciones…). */
export const parseNotes = parseWith(notesShapeError);
/** Decisión y texto de la siguiente pregunta. */
export const parseQuestion = parseWith(questionShapeError);

/**
 * Preguntas que bloquean (taller, "Preguntas que bloquean" y "Cuidado al investigar").
 * `unlessUserSaid`: se permite retomar el tema si la persona lo mencionó primero,
 * con sus palabras.
 */
const BLOCKED = [
  { re: /certific/, why: 'sugiere_certificarse', unlessUserSaid: /certific/ },
  { re: /\b(app|apps|aplicacion|aplicaciones|aplicativo)\b/, why: 'introduce_una_aplicacion', unlessUserSaid: /\b(app|apps|aplicacion|aplicaciones|aplicativo)\b/ },
  { re: /\bfalta(n)? (de )?(capacitacion|preparacion|estudios?|formacion)/, why: 'asume_falta_de_capacitacion' },
  { re: /\b(sientes|crees) que te falta/, why: 'asume_carencia' },
  { re: /\b(miedo|temor|angustia|ansiedad|preocupad\w*|frustrad\w*|triste)\b/, why: 'presupone_una_emocion', unlessUserSaid: /\b(miedo|temor|angusti\w*|ansi\w*|preocup\w*|frustr\w*|triste\w*)\b/ },
  { re: /\bplanilla\b|\btrabajo formal\b|\bempleo formal\b/, why: 'presupone_deseo_de_empleo_formal', unlessUserSaid: /planilla|formal|contrato/ },
  { re: /\b(desemplead\w*|sin (trabajo|empleo)|perdiste tu (trabajo|empleo)|te despidieron|despido)\b/, why: 'presupone_desempleo', unlessUserSaid: /desemple\w*|sin (trabajo|empleo)|perdi\w*|despid\w*|me botaron|no tengo (trabajo|chamba)/ },
  { re: /\binformal(es|idad)?\b/, why: 'presupone_informalidad', unlessUserSaid: /informal|sin contrato|por mi cuenta|por encargo/ },
  { re: /\b(competencias?|habilidades blandas|perfil laboral|empleabilidad)\b/, why: 'vocabulario_tecnico' },
  { re: /\b(verdad|cierto|no es asi)\s*\?/, why: 'pide_confirmar_hipotesis' },
  { re: /\b(no crees que|no te parece que|seguramente|supongo que)\b/, why: 'pregunta_sugestiva' },
  { re: /\b(dni|direccion|telefono|celular|correo|email)\b/, why: 'pide_datos_personales' },
];

/** Juicios o interpretaciones presentadas como hechos. */
const JUDGMENT = [
  { re: /\beres (una persona )?(muy )?(buen[oa]|responsable|trabajador[a]?|capaz|organizad[oa]|ordenad[oa]|excelente|talentos[oa])\b/, why: 'presenta_cualidad_como_hecho' },
  { re: /\b(se nota que|es evidente que|sin duda|claramente tienes)\b/, why: 'presenta_interpretacion_como_hecho' },
  { re: /\b(deberias|tienes que|te recomiendo|te sugiero|inscribete|lo mejor es)\b/, why: 'aconseja_o_dirige' },
  { re: /\b(que pena|lamentablemente|que mal que)\b/, why: 'juzga_la_situacion' },
];

const SERVICES = /\b(empleos peru|capacitate peru)\b/;

/** Sin signo de interrogación, la pregunta debe ser una invitación a contar. */
const INVITATION = /\b(cuentame|cuentanos|describeme|hablame|explicame|platicame)\b/;

/** Acciones que siguen un detalle de la última respuesta: deben citarlo. */
const FOLLOW_UP = ['profundizar', 'pedir_ejemplo', 'aclarar', 'contrastar'];

const STOPWORDS = new Set(
  'de la el los las un una unos unas y o a en con por para lo le les tu te me mi se su sus que es fue al del mas muy ya hay esto eso esa ese'.split(' '),
);

function tokens(text) {
  return new Set(
    comparable(text)
      .split(' ')
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Similitud de Jaccard entre dos textos (0 a 1). */
export function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export const REPEAT_THRESHOLD = 0.6;

/**
 * ¿El detalle que sigue la pregunta sale de lo que dijo la persona? Se compara
 * por raíz (4 letras) para admitir otra conjugación ("atender" / "atiendo" no,
 * pero "gente" sí): al menos la mitad de sus palabras deben aparecer.
 */
export function detailSupported(detail, texts) {
  const root = (w) => w.slice(0, 4);
  const d = [...tokens(detail)].map(root);
  if (!d.length) return false;
  const pool = new Set(texts.flatMap((t) => [...tokens(t)].map(root)));
  return d.filter((w) => pool.has(w)).length / d.length >= 0.5;
}

/** ¿El texto copia la respuesta de la persona en lugar de preguntar? */
function copiesAnswer(question, answer) {
  if (!answer) return false;
  const a = comparable(answer);
  return (a.split(' ').length >= 6 && comparable(question).includes(a)) || similarity(question, answer) >= 0.7;
}

/**
 * Revisa la pregunta propuesta. Devuelve la lista de motivos de rechazo
 * (vacía si se puede mostrar).
 *
 * @param {object} q            salida parseada de la tarea "pregunta"
 * @param {object} ctx
 * @param {object} ctx.prev     estado de la entrevista ANTES de este turno
 * @param {number} ctx.turns    respuestas de la persona contando la actual
 * @param {number} ctx.evidenceCount evidencias válidas tras incorporar este turno
 * @param {string[]} ctx.userTexts   respuestas de la persona (redactadas)
 * @param {boolean} ctx.opening       primer turno (todavía no hay respuesta)
 * @param {boolean=} ctx.newTopic     la última respuesta trajo lo primero sobre un área sin explorar
 */
export function reviewQuestion(q, ctx) {
  const reasons = [];
  const userCorpus = comparable(ctx.userTexts.join(' '));
  const lastAnswer = ctx.opening ? '' : ctx.userTexts.at(-1) || '';
  const question = q.pregunta.trim();
  const detail = q.detalle.trim();

  if (q.accion === 'cerrar') {
    if (ctx.opening || ctx.turns < LIMITS.minTurnsToClose) reasons.push('cierre_prematuro');
    else if (!ctx.evidenceCount) reasons.push('cierre_sin_evidencia');
    // Si la última respuesta abrió un tema nuevo, primero se profundiza (taller: "si aparece algo interesante…").
    else if (ctx.newTopic) reasons.push('cierre_con_tema_nuevo');
    return reasons;
  }

  if (!question) reasons.push('pregunta_vacia');
  const qn = comparable(question);
  const marks = (question.match(/\?/g) || []).length;
  if (marks > 1) reasons.push('mas_de_una_pregunta');
  if (marks === 0 && !INVITATION.test(qn)) reasons.push('no_es_pregunta');
  if (question.length > LIMITS.maxQuestionChars) reasons.push('pregunta_larga');
  if (copiesAnswer(question, lastAnswer)) reasons.push('copia_la_respuesta');

  for (const prev of ctx.prev.preguntas) {
    if (similarity(prev.texto, question) >= REPEAT_THRESHOLD) {
      reasons.push('pregunta_repetida');
      break;
    }
  }

  // Seguimiento: debe apoyarse en algo que la persona dijo, con sus palabras.
  if (!ctx.opening && FOLLOW_UP.includes(q.accion)) {
    const pool = q.accion === 'contrastar' ? ctx.userTexts : [lastAnswer];
    if (!detail) reasons.push('seguimiento_sin_detalle');
    else if (!isLiteralQuote(detail, pool) && !detailSupported(detail, pool)) reasons.push('detalle_sin_respaldo');
  }

  if (ctx.prev.areas[q.area] === 'suficiente' && ['preguntar', 'retomar'].includes(q.accion)) reasons.push('area_ya_cubierta');
  if (SERVICES.test(qn) && q.area !== 'despues' && !SERVICES.test(userCorpus)) reasons.push('introduce_servicio_antes_de_tiempo');

  // normalize() conserva los signos, necesarios para detectar "…, ¿verdad?".
  const said = normalize(question);
  for (const rule of BLOCKED) {
    if (rule.re.test(said) && !(rule.unlessUserSaid && rule.unlessUserSaid.test(userCorpus))) reasons.push(rule.why);
  }
  for (const rule of JUDGMENT) if (rule.re.test(said)) reasons.push(rule.why);

  return [...new Set(reasons)];
}
