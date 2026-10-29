/**
 * Catálogo de las CINCO ocupaciones de REFERENCIA de KALLPA.
 *
 * Son la base del diagnóstico, la tabla comparativa y la ruta laboral.
 * Los puestos para postular (que pueden estar fuera de estas cinco)
 * viven en data/jobs.js y enlazan a Empleos Perú.
 *
 * Los requisitos (`requires`) son competencias iniciales de referencia
 * (datos de demostración). En producción deberían reemplazarse por
 * perfiles ocupacionales validados (por ejemplo, estándares del MTPE).
 *
 * weight:
 *  - 'clave'          → competencia central del puesto
 *  - 'complementaria' → suma, pero no es central
 */

export const OCCUPATION_IDS = ['limpieza', 'administrativo', 'reponedor', 'vendedor', 'cajero'];

export const OCCUPATIONS = {
  limpieza: {
    id: 'limpieza',
    name: 'Personal de limpieza',
    short: 'Limpieza',
    icon: 'limpieza',
    tone: 'limpieza',
    summary:
      'Mantiene espacios limpios, ordenados y seguros siguiendo protocolos de higiene, con buen uso de productos y materiales.',
    requires: [
      { id: 'org_materiales', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'protocolos', weight: 'clave' },
      { id: 'control_suministros', weight: 'clave' },
    ],
    requirements: [
      'Disponibilidad para trabajar por turnos (varía según cada aviso).',
      'Conocer normas básicas de seguridad e higiene.',
    ],
    nextSteps: [
      'Repasa las fichas de seguridad de los productos que usas y cómo se diluyen.',
      'Anota en una lista simple qué insumos revisas y cada cuánto lo haces.',
      'Pide a tu supervisor una referencia que mencione tu cumplimiento de protocolos.',
    ],
    interview: [
      '¿Cómo organizas tus materiales al empezar el turno?',
      '¿Qué haces si un producto de limpieza se está acabando?',
      '¿Qué cuidados tienes al usar productos químicos?',
    ],
  },
  administrativo: {
    id: 'administrativo',
    name: 'Auxiliar administrativo',
    short: 'Aux. administrativo',
    icon: 'administrativo',
    tone: 'administrativo',
    summary:
      'Apoya a una oficina organizando documentos, registrando información, usando herramientas digitales y coordinando tareas.',
    requires: [
      { id: 'org_documentos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
    requirements: [
      'Manejo básico de computadora, correo y hojas de cálculo (según cada aviso).',
      'Algunos avisos piden secundaria completa o estudios técnicos: revisa cada convocatoria.',
    ],
    nextSteps: [
      'Practica registrar datos en una hoja de cálculo (nombres, fechas, montos).',
      'Ordena tus propios documentos por tipo y fecha para practicar archivo.',
      'Aprende a escribir un correo formal corto y claro.',
    ],
    interview: [
      '¿Cómo ordenarías documentos que llegan todos los días?',
      '¿Qué programas o aplicaciones sabes usar?',
      '¿Cómo te aseguras de no olvidar una tarea o un encargo?',
    ],
  },
  reponedor: {
    id: 'reponedor',
    name: 'Reponedor y abastecedor',
    short: 'Reponedor',
    icon: 'reponedor',
    tone: 'reponedor',
    summary:
      'Mantiene los productos disponibles: recibe mercadería, controla existencias, repone estantes y organiza la exhibición.',
    requires: [
      { id: 'org_productos', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'reposicion', weight: 'clave' },
      { id: 'recepcion_mercaderia', weight: 'clave' },
      { id: 'protocolos', weight: 'complementaria' },
    ],
    requirements: [
      'Puede requerir esfuerzo físico y trabajo por turnos (varía según cada aviso).',
      'Conocer cuidados básicos al cargar y mover productos.',
    ],
    nextSteps: [
      'Aprende la regla “lo primero que vence, sale primero” para ordenar productos.',
      'Practica contar productos y anotar entradas y salidas en una tabla.',
      'Pregunta en tu trabajo actual si puedes apoyar en la recepción de pedidos.',
    ],
    interview: [
      '¿Cómo decides qué producto reponer primero?',
      '¿Qué revisas cuando llega mercadería?',
      '¿Cómo te das cuenta de que falta un producto?',
    ],
  },
  vendedor: {
    id: 'vendedor',
    name: 'Vendedor de tienda',
    short: 'Vendedor',
    icon: 'vendedor',
    tone: 'vendedor',
    summary:
      'Atiende y asesora a clientes, comunica bien, vende productos, cuida la exhibición y gestiona pedidos.',
    requires: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'ventas', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
    ],
    requirements: [
      'Disponibilidad para fines de semana o feriados en algunos avisos.',
      'Trato amable y paciencia con el público.',
    ],
    nextSteps: [
      'Practica presentar un producto en tres frases: qué es, para qué sirve y por qué conviene.',
      'Anota los pedidos que tomes con fecha, producto y contacto del cliente.',
      'Observa cómo se ordena la vitrina o el estante en una tienda que conozcas.',
    ],
    interview: [
      '¿Cómo atiendes a un cliente que no sabe qué comprar?',
      '¿Qué haces si un cliente está molesto?',
      '¿Cómo llevas el control de un pedido?',
    ],
  },
  cajero: {
    id: 'cajero',
    name: 'Cajero',
    short: 'Cajero',
    icon: 'cajero',
    tone: 'cajero',
    summary:
      'Cobra con exactitud, calcula el vuelto, atiende al cliente, usa distintos medios de pago y registra las transacciones.',
    requires: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'calculo_vuelto', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'medios_pago', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'clave' },
    ],
    requirements: [
      'Algunos avisos piden referencias laborales por el manejo de dinero.',
      'Rapidez y atención al detalle en el cobro.',
    ],
    nextSteps: [
      'Practica sumar montos y calcular vueltos mentalmente con ejemplos reales.',
      'Aprende cómo funcionan POS, Yape, Plin y transferencias.',
      'Practica un cuadre de caja simple: lo que entró, lo que salió y lo que queda.',
    ],
    interview: [
      '¿Cómo evitas errores al dar vuelto?',
      '¿Qué haces si al final del día la caja no cuadra?',
      '¿Qué medios de pago has usado?',
    ],
  },
};

export const getOccupation = (id) => OCCUPATIONS[id];
export const occupationList = () => OCCUPATION_IDS.map((id) => OCCUPATIONS[id]);
