/**
 * Guion del Modo demostración (caso ficticio de María).
 * Cada paso indica la pantalla, qué se destaca y una narración breve.
 */
export const DEMO_STEPS = [
  {
    id: 'intro',
    route: '/',
    title: 'Conoce a María',
    text: 'María es una persona ficticia. Trabaja hace más de cinco años en limpieza de oficinas, con y sin contrato. Veamos cómo Kalna la ayuda a reconocer lo que sabe.',
    duration: 7000,
  },
  {
    id: 'relato',
    route: '/diagnostico',
    title: 'María cuenta su experiencia',
    text: 'Responde con sus palabras sobre sus tareas, herramientas, responsabilidades y una situación que resolvió. Kalna reconoce posibles competencias.',
    chat: { from: 'relato', to: 'evidencias' },
    duration: 6000,
  },
  {
    id: 'evidencias',
    route: '/diagnostico',
    title: 'Respalda con ejemplos',
    text: 'Kalna le pide ejemplos concretos. Las competencias con un buen ejemplo pasan a «Con evidencia». Ninguna queda certificada.',
    chat: { from: 'evidencias', to: 'fin' },
    duration: 6000,
  },
  {
    id: 'perfil',
    route: '/perfil',
    title: 'Su perfil de competencias',
    text: 'Cada competencia muestra su estado y lo que María contó para respaldarla.',
    duration: 9000,
  },
  {
    id: 'puestos',
    route: '/ocupaciones',
    title: 'Puestos recomendados',
    text: 'Según sus competencias, Kalna le recomienda puestos, incluso fuera de su rubro. Cuando se decide por uno, crea su ruta o su pasaporte desde el panel del puesto.',
    duration: 10000,
  },
];

/** Tiempo entre mensajes al reproducir la conversación de la demostración. */
export const CHAT_MESSAGE_MS = 700;

/** Duración real de un paso: los pasos de chat esperan a que termine la conversación. */
export function stepDuration(step, data) {
  if (!step.chat || !data) return step.duration;
  const from = data.checkpoints[step.chat.from] ?? 0;
  const to = data.checkpoints[step.chat.to] ?? data.transcript.length;
  return step.duration + Math.max(0, to - from) * CHAT_MESSAGE_MS;
}
