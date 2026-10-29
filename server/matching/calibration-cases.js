/**
 * Casos etiquetados para CALIBRAR y evaluar la búsqueda semántica
 * (`calibracion-v1`). Las frases están escritas con palabras distintas a las
 * referencias de server/catalog/competency-references.js (una prueba lo
 * comprueba), para medir si el modelo reconoce el significado y no solo
 * palabras repetidas.
 *
 * - positives: evidencia → competencias aceptables (cualquiera de ellas es correcta).
 * - negatives: experiencias sin competencia equivalente en el catálogo actual.
 * - ambiguous: frases sin hecho concreto; no deben producir candidatas fuertes.
 * - jobs:      evidencia → empleos sintéticos pertinentes (alguno debe salir arriba).
 * - transfers: pares de competencias con relación de transferencia razonable
 *              (positivos) y pares sin relación (negativos), para el umbral de
 *              transferencia semántica.
 */
export const CALIBRATION_VERSION = 'calibracion-v1';

export const POSITIVES = [
  { text: 'Organizaba los libros de la biblioteca de mi parroquia por temas y encontraba cualquiera rápido', expected: ['org_documentos', 'org_materiales', 'org_productos'] },
  { text: 'Acomodaba las chompas por talla y color para ubicarlas al toque', expected: ['org_productos'] },
  { text: 'Una vez la caja no cuadraba y revisé los vouchers uno por uno', expected: ['manejo_dinero', 'registro_transacciones'] },
  { text: 'Preparaba la mezcla de cloro con agua según lo que decía el envase', expected: ['uso_productos'] },
  { text: 'Le avisaba a mi jefa cuando el almacén se estaba quedando sin papel toalla', expected: ['control_suministros', 'control_existencias'] },
  { text: 'Pasaba a la compu las notas de los alumnos y revisaba que no hubiera errores', expected: ['registro_info', 'herramientas_digitales'] },
  { text: 'Contestaba los mensajes de los clientes por Instagram y les mandaba fotos de los productos', expected: ['herramientas_digitales', 'ventas', 'comunicacion', 'atencion_cliente', 'gestion_pedidos'] },
  { text: 'Organizaba quién cocinaba cada día en el comedor y les recordaba su turno', expected: ['coordinacion'] },
  { text: 'Revisaba que llegaran completas las cajas que traía el camión', expected: ['recepcion_mercaderia'] },
  { text: 'Llenaba los estantes de abarrotes cuando se vaciaban', expected: ['reposicion'] },
  { text: 'Contaba los sacos de arroz que quedaban en el depósito cada fin de mes', expected: ['control_existencias'] },
  { text: 'Escuchaba con calma a los clientes que venían a reclamar y les buscaba una solución', expected: ['atencion_cliente'] },
  { text: 'Convencía a la gente de comprar mis queques en la feria del colegio', expected: ['ventas'] },
  { text: 'Anotaba los encargos de comida con hora de entrega y dirección', expected: ['gestion_pedidos', 'registro_info'] },
  { text: 'Sacaba la cuenta y el vuelto de cabeza sin calculadora', expected: ['calculo_vuelto'] },
  { text: 'Cobraba con Yape y verificaba que llegara el pago antes de entregar', expected: ['medios_pago'] },
  { text: 'Apuntaba en un cuaderno todo lo que se vendía y lo que me quedaban debiendo', expected: ['registro_transacciones', 'registro_info'] },
  { text: 'Siempre me lavaba las manos y usaba guantes y mascarilla antes de manipular la comida', expected: ['protocolos'] },
  { text: 'Guardaba las escobas, trapeadores y baldes cada uno en su sitio', expected: ['org_materiales'] },
  { text: 'Les explicaba a los nuevos cómo usar la máquina con palabras sencillas', expected: ['comunicacion'] },
  { text: 'Archivaba los contratos en carpetas por año y apellido', expected: ['org_documentos'] },
  { text: 'Usaba Excel para hacer el control de asistencia de mis compañeros', expected: ['herramientas_digitales', 'registro_info'] },
  { text: 'Juntaba la plata de las cuotas del club de madres y rendía cuentas cada mes', expected: ['manejo_dinero', 'registro_transacciones'] },
  { text: 'Ponía delante los yogures que vencían primero', expected: ['org_productos', 'reposicion', 'control_existencias'] },
  { text: 'Coordinaba con el chofer y el almacén para que el pedido saliera a tiempo', expected: ['coordinacion', 'gestion_pedidos'] },
  { text: 'Seguía la lista de pasos de seguridad antes de prender la máquina', expected: ['protocolos'] },
];

export const NEGATIVES = [
  'Componía canciones y daba clases de guitarra a mis sobrinos',
  'Juego fútbol todos los domingos con mis amigos',
  'Me gusta ver películas de acción en la noche',
  'Manejaba un mototaxi en mi distrito',
  'Cuidaba a mi abuelita cuando estaba enferma',
  'Sembraba papa y maíz en la chacra de mi familia',
  'Pintaba cuadros al óleo como pasatiempo',
];

export const AMBIGUOUS = ['Hacía de todo un poco en la tienda', 'Trabajaba en un restaurante', 'Era bien responsable y puntual'];

export const JOB_CASES = [
  { text: 'Organizaba los libros de la biblioteca de mi parroquia por temas y encontraba cualquiera rápido', expected: ['sint_archivo', 'sint_auxiliar_almacen', 'sint_inventariador', 'sint_picking_packing', 'sint_mesa_partes'] },
  { text: 'Una vez la caja no cuadraba y revisé los vouchers uno por uno', expected: ['sint_cajero_supermercado', 'sint_supervisor_cajas', 'sint_auxiliar_tesoreria', 'sint_auxiliar_cobranzas', 'sint_encargado_minimarket'] },
  { text: 'Preparaba la mezcla de cloro con agua según lo que decía el envase', expected: ['sint_limpieza_oficinas', 'sint_limpieza_hospitalaria', 'sint_fumigacion', 'sint_camarera_pisos'] },
  { text: 'Contestaba los mensajes de los clientes por Instagram y les mandaba fotos de los productos', expected: ['sint_atencion_redes', 'sint_ventas_whatsapp'] },
  { text: 'Revisaba que llegaran completas las cajas que traía el camión', expected: ['sint_auxiliar_almacen', 'sint_auxiliar_despacho', 'sint_abastecedor_grifo_tienda', 'sint_asistente_supervisor_almacen', 'sint_inventariador'] },
  { text: 'Llenaba los estantes de abarrotes cuando se vaciaban', expected: ['sint_abastecedor_grifo_tienda', 'sint_mercaderista'] },
  { text: 'Anotaba los encargos de comida con hora de entrega y dirección', expected: ['sint_coordinador_pedidos_delivery', 'sint_mozo', 'sint_ventas_whatsapp'] },
];

// Relaciones de transferencia razonables (además de `bases` del catálogo) y pares sin relación.
export const TRANSFER_NEGATIVES = [
  ['uso_productos', 'ventas'],
  ['calculo_vuelto', 'protocolos'],
  ['herramientas_digitales', 'org_materiales'],
  ['reposicion', 'comunicacion'],
  ['medios_pago', 'uso_productos'],
  ['org_documentos', 'manejo_dinero'],
];
