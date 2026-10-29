/**
 * Configuración de la evaluación y anotaciones de KALLPA sobre el banco original
 * (`source/banco-preguntas-kallpa.txt`).
 *
 * - `ASSESSMENT_PROFILES`: competencias que se evalúan en cada puesto, tal como
 *   las enumera el encabezado de cada módulo del material. `catalogId` enlaza con
 *   la competencia más cercana de src/data/competencies.js (null si no hay una).
 * - `QUESTION_ANNOTATIONS`: por número de pregunta del material, la competencia
 *   PRINCIPAL que mide (una sola) y una explicación breve fundada en la
 *   alternativa correcta. La clave de respuesta NO se anota aquí: sale siempre
 *   del marcador [CORRECTA] del material.
 *
 * La asignación de competencias es una propuesta de KALLPA y conviene que la
 * revise una persona experta (ver docs/evaluacion-competencias.md).
 */

export const ASSESSMENT_PROFILES = {
  limpieza: [
    { key: 'uso_productos', name: 'Uso adecuado de productos', catalogId: 'uso_productos' },
    { key: 'protocolos', name: 'Cumplimiento de protocolos', catalogId: 'protocolos' },
    { key: 'control_suministros', name: 'Control de suministros', catalogId: 'control_suministros' },
    { key: 'org_materiales', name: 'Organización de materiales', catalogId: 'org_materiales' },
  ],
  administrativo: [
    { key: 'herramientas_digitales', name: 'Uso de herramientas digitales', catalogId: 'herramientas_digitales' },
    { key: 'registro_info', name: 'Registro de información', catalogId: 'registro_info' },
    { key: 'comunicacion', name: 'Comunicación', catalogId: 'comunicacion' },
    { key: 'organizacion', name: 'Organización', catalogId: 'org_documentos' },
  ],
  reponedor: [
    { key: 'org_materiales', name: 'Organización de materiales', catalogId: 'org_productos' },
    { key: 'control_suministros', name: 'Control de suministros', catalogId: 'control_existencias' },
    { key: 'protocolos', name: 'Cumplimiento de protocolos', catalogId: 'protocolos' },
  ],
  vendedor: [
    { key: 'comunicacion', name: 'Comunicación', catalogId: 'comunicacion' },
    { key: 'herramientas_digitales', name: 'Uso de herramientas digitales', catalogId: 'herramientas_digitales' },
    { key: 'uso_productos', name: 'Uso de productos', catalogId: 'ventas' },
  ],
  cajero: [
    { key: 'herramientas_digitales', name: 'Uso de herramientas digitales', catalogId: 'herramientas_digitales' },
    { key: 'registro_info', name: 'Registro de información', catalogId: 'registro_transacciones' },
    { key: 'comunicacion', name: 'Comunicación', catalogId: 'comunicacion' },
    { key: 'protocolos', name: 'Protocolos', catalogId: 'protocolos' },
  ],
};

/** Módulo del material → puesto de KALLPA. */
export const MODULE_OCCUPATIONS = {
  'Personal de Limpieza': 'limpieza',
  'Auxiliar Administrativo': 'administrativo',
  'Reponedor y Abastecedor': 'reponedor',
  'Vendedor de Tienda': 'vendedor',
  Cajero: 'cajero',
};

export const QUESTION_ANNOTATIONS = {
  1: { competency: 'protocolos', explanation: 'Ante un líquido desconocido, lo primero es proteger a las personas y no aplicar químicos sin saber qué es: se aísla la zona, se ventila y se reporta para recibir indicaciones.' },
  2: { competency: 'control_suministros', explanation: 'Avisar a tiempo al responsable permite usar el stock de reserva o un producto aprobado, sin diluir de más ni usar insumos no autorizados.' },
  3: { competency: 'org_materiales', explanation: 'Dejar los materiales limpios, rellenados, etiquetados y registrados permite que el siguiente turno trabaje rápido y con seguridad.' },
  4: { competency: 'uso_productos', explanation: 'Cada superficie necesita su producto: la lejía o un abrasivo pueden fijar la mancha o dañar la fibra. Lo adecuado es explicarlo y pedir el limpiador textil.' },
  5: { competency: 'herramientas_digitales', explanation: 'Ordenar primero, digitalizar en bloque y registrar los datos clave en una plantilla con totales verificados es rápido y deja información útil y comprobable.' },
  6: { competency: 'comunicacion', explanation: 'Se respeta la indicación del gerente y se atiende al cliente con firmeza y respeto: se registra su reclamo y se asume un compromiso concreto, sin mentir.' },
  7: { competency: 'organizacion', explanation: 'Una estructura por categoría y fecha, con nombres de archivo uniformes, permite encontrar cualquier documento y mantener el orden en el tiempo.' },
  8: { competency: 'registro_info', explanation: 'Un acta registra lo que sirve a la organización: argumentos, mociones y acuerdos de la agenda, de forma objetiva y sin ataques personales.' },
  9: { competency: 'org_materiales', explanation: 'Con la rotación FIFO (lo primero que entra, sale primero) se vende antes lo que vence antes y se evitan pérdidas; además se aprovecha para limpiar el estante.' },
  10: { competency: 'control_suministros', explanation: 'Antes de concluir, se verifica en otras ubicaciones y contra las ventas, y el descuadre se reporta formalmente; nunca se ajusta el sistema por cuenta propia.' },
  11: { competency: 'protocolos', explanation: 'La prioridad es la seguridad de los clientes: se resguarda el área, se señaliza, se limpia con las herramientas adecuadas y se registra la merma.' },
  12: { competency: 'protocolos', explanation: 'Una salida de emergencia bloqueada es un riesgo inmediato: se despeja con el equipo adecuado y se reporta el incidente para que no se repita.' },
  13: { competency: 'comunicacion', explanation: 'Reconocer el error con una disculpa y ofrecer alternativas concretas mantiene la confianza del cliente aunque el producto no esté disponible.' },
  14: { competency: 'uso_productos', explanation: 'Ser honesto y consultar la ficha técnica oficial junto al cliente da información correcta sobre el producto, en lugar de inventar o abandonar la consulta.' },
  15: { competency: 'comunicacion', explanation: 'Se reconoce al otro cliente con amabilidad sin abandonar al primero, y se busca apoyo para que ambos reciban buena atención.' },
  // Mide protocolos, que no figura entre las competencias del módulo de Vendedor: queda en el banco, pero no se usa en ese puesto.
  16: { competency: 'protocolos', explanation: 'Ante una posible pérdida, no se manipula la vitrina y se reporta de inmediato a los responsables para revisar las cámaras.' },
  17: { competency: 'herramientas_digitales', explanation: 'Antes de cobrar de nuevo, se verifica si el pago se realizó (app bancaria y portal del POS) y se sigue el procedimiento con el supervisor para recuperar el comprobante.' },
  18: { competency: 'protocolos', explanation: 'Se retiene el billete y se pide apoyo con discreción, tratando al cliente con respeto y ofreciéndole otro medio de pago.' },
  19: { competency: 'registro_info', explanation: 'Se busca el origen del faltante (recuento y cobros mal registrados) y, si persiste, se documenta y se reporta; nunca se borran ventas ni se cubre con dinero propio.' },
  20: { competency: 'comunicacion', explanation: 'Pedir al cliente que escriba su RUC evita errores al dictarlo y, mientras tanto, se resuelve lo del papel con una disculpa breve.' },
};
