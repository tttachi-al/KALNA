/**
 * Guía de la entrevista adaptativa, tomada del "Taller de levantamiento de
 * información" (ULIMA X · INNOVATHON). Las áreas y las preguntas de
 * referencia son una guía interna: el modelo elige qué preguntar en cada turno.
 */

export const AREAS = ['antes', 'hoy', 'cambios', 'despues'];

export const AREA_LABELS = {
  antes: 'Trayectoria laboral (antes)',
  hoy: 'Experiencia actual (hoy)',
  cambios: 'Cambios, riesgos y barreras',
  despues: 'Alternativas y próximos pasos (después)',
};

export const AREA_STATUS = ['pendiente', 'parcial', 'suficiente'];

/** Qué se registró de lo que dijo la persona. */
export const SAID_CATEGORIES = [
  'contexto',
  'trayectoria',
  'tareas',
  'conocimientos',
  'habilidades',
  'resultados',
  'motivaciones',
  'barreras',
  'canales',
  'otros',
];

/** Área a la que aporta cada categoría de lo que dijo la persona. */
export const CATEGORY_AREA = {
  trayectoria: 'antes',
  contexto: 'hoy',
  tareas: 'hoy',
  conocimientos: 'hoy',
  habilidades: 'hoy',
  resultados: 'hoy',
  barreras: 'cambios',
  motivaciones: 'despues',
  canales: 'despues',
};

/** Conocimiento = qué sabe; habilidad = qué sabe hacer; cualidad = cómo es; competencia = resultado demostrable. */
export const INTERPRETATION_TYPES = ['conocimiento', 'habilidad', 'cualidad', 'competencia_potencial', 'motivacion', 'barrera', 'tension'];

export const ACTIONS = ['preguntar', 'profundizar', 'pedir_ejemplo', 'aclarar', 'contrastar', 'retomar', 'cerrar'];

/** Tipos de pregunta de la dinámica "Caza del porqué" del taller (+ aclaración y cierre). */
export const QUESTION_TYPES = ['experiencial', 'contexto', 'comportamiento', 'profundizacion', 'contraste', 'aclaracion', 'cierre'];

/** Preguntas de referencia del taller, por área. Se usan solo si el modelo no da una pregunta válida. */
export const REFERENCE_QUESTIONS = {
  antes: [
    { type: 'experiencial', text: '¿Cómo aprendiste lo que haces hoy?' },
    { type: 'contexto', text: '¿Quién te enseñó?' },
    { type: 'profundizacion', text: '¿Por qué elegiste ese trabajo?' },
  ],
  hoy: [
    { type: 'experiencial', text: 'Cuéntame cómo es un día típico en tu trabajo.' },
    { type: 'comportamiento', text: '¿Qué es lo que mejor sabes hacer y cómo lo sabes?' },
    { type: 'contexto', text: '¿Qué cosas te piden hacer a ti porque saben que las haces bien?' },
    { type: 'experiencial', text: 'Cuéntame una vez que resolviste un problema en tu trabajo.' },
    { type: 'comportamiento', text: 'Si tuvieras que enseñarle tu trabajo a alguien nuevo, ¿qué le dirías primero?' },
    { type: 'comportamiento', text: '¿Cómo le demostrarías a un nuevo empleador que sabes hacerlo?' },
  ],
  cambios: [
    { type: 'experiencial', text: 'Cuéntame la última vez que bajaron tus horas, turnos o encargos. ¿Qué hiciste?' },
    { type: 'profundizacion', text: '¿Qué otros trabajos has pensado hacer? ¿Qué te detuvo?' },
    { type: 'contexto', text: '¿Qué dificultades encuentras cuando intentas cambiar de trabajo?' },
  ],
  despues: [
    { type: 'contexto', text: '¿Qué opciones laborales ves para ti?' },
    { type: 'comportamiento', text: '¿Dónde buscas trabajo o cursos cuando lo necesitas?' },
    { type: 'profundizacion', text: '¿Qué te gustaría cambiar de tu situación actual y por qué?' },
    { type: 'contexto', text: '¿Cuánto tiempo podrías dedicar a aprender algo nuevo sin dejar de trabajar?' },
    { type: 'profundizacion', text: '¿Qué te ayudaría a dar el primer paso?' },
  ],
};

/** Límites de la conversación (decididos por código, no por el modelo). */
export const LIMITS = {
  /** Respuestas de la persona antes de permitir el cierre. */
  minTurnsToClose: 4,
  /** Tope de respuestas: al llegar, la entrevista se cierra aunque el modelo quiera seguir. */
  maxTurns: 12,
  /** Mensajes del diálogo que se envían al modelo (el resto lo resume el estado estructurado). */
  historyWindow: 16,
  maxQuestionChars: 260,
};
