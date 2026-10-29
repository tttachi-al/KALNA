/**
 * Referencias semánticas de las competencias del catálogo (`referencias-v1`).
 *
 * Para cada competencia de src/data/competencies.js:
 *  - indicators: conductas observables (qué se ve cuando alguien la tiene).
 *  - examples:   cómo lo cuenta la gente en su día a día, también en
 *                contextos NO laborales (casa, familia, parroquia, mercado…).
 *
 * Se convierten en embeddings (competency_embeddings, text_kind 'indicador' y
 * 'ejemplo') para comparar con las evidencias de la persona. No añaden
 * competencias nuevas ni sustituyen la validación: solo proponen candidatas.
 *
 * Contenido de DEMOSTRACIÓN escrito por el equipo KALLPA (validation: 'demo'),
 * pendiente de revisión por personas con experiencia en orientación laboral.
 */
export const REFERENCES_VERSION = 'referencias-v1';
export const REFERENCES_VALIDATION = 'demo';

export const COMPETENCY_REFERENCES = {
  org_materiales: {
    indicators: [
      'Guarda los materiales y herramientas siempre en un lugar fijo para encontrarlos rápido',
      'Prepara antes de empezar todo lo que va a necesitar',
      'Separa y rotula los materiales por tipo o uso',
    ],
    examples: [
      'Antes de empezar dejo listo mi carrito con trapos, baldes y escobas en su sitio',
      'En mi casa tengo las herramientas colgadas por tamaño y sé dónde está cada una',
      'En el taller de costura guardaba hilos y telas en cajas marcadas por color',
      'Al terminar limpio y devuelvo cada cosa a su lugar para el día siguiente',
    ],
  },
  uso_productos: {
    indicators: [
      'Elige el producto adecuado según la superficie o la tarea',
      'Diluye o dosifica los productos según la etiqueta',
      'Usa protección y no mezcla productos peligrosos',
    ],
    examples: [
      'Leo la etiqueta y echo la cantidad justa de lejía en el balde con agua',
      'Para la madera uso un producto y para la cerámica otro, si no se malogra',
      'Nunca mezclo lejía con detergente porque bota gases',
      'Me pongo guantes cuando uso el desinfectante fuerte',
    ],
  },
  protocolos: {
    indicators: [
      'Sigue los pasos establecidos en el mismo orden cada vez',
      'Cumple normas de higiene y de seguridad aunque nadie lo supervise',
      'Avisa cuando un procedimiento no se puede cumplir',
    ],
    examples: [
      'Me lavo las manos y me pongo gorro antes de tocar los alimentos',
      'Siempre limpio primero lo más limpio y al final los baños, como me enseñaron',
      'Cuando veo un piso mojado pongo el cartel de cuidado',
      'En el comedor popular seguíamos la lista de pasos de higiene cada día',
    ],
  },
  control_suministros: {
    indicators: [
      'Revisa periódicamente qué insumos quedan',
      'Avisa o pide reposición antes de que algo se acabe',
      'Lleva una lista de lo que falta',
    ],
    examples: [
      'Cada lunes reviso cuánto detergente y papel queda y le aviso a la encargada',
      'En casa apunto en un papel lo que se está acabando antes de ir al mercado',
      'Me doy cuenta cuando queda poco jabón y lo pido con tiempo',
      'Llevaba la cuenta de los víveres de la olla común para que no faltaran',
    ],
  },
  org_documentos: {
    indicators: [
      'Clasifica documentos por tipo, fecha o tema',
      'Archiva de forma que cualquier documento se encuentra rápido',
      'Mantiene ordenados papeles y carpetas físicas o digitales',
    ],
    examples: [
      'Guardo las facturas en folders por mes y las encuentro al toque',
      'En la oficina ordenaba los expedientes por número y fecha',
      'Tengo los recibos de luz y agua de mi casa archivados por año',
      'En el colegio ayudaba a ordenar las fichas de matrícula por grado',
    ],
  },
  registro_info: {
    indicators: [
      'Anota datos de forma completa y exacta',
      'Lleva registros en cuadernos, hojas de cálculo o sistemas',
      'Revisa que la información registrada no tenga errores',
    ],
    examples: [
      'Pasaba los datos de las fichas a una hoja de Excel sin equivocarme',
      'Anotaba en un cuaderno quién entraba y salía del edificio',
      'Llevo la lista de asistencia de las reuniones de la junta vecinal',
      'Registraba los pedidos con fecha, nombre y teléfono del cliente',
    ],
  },
  herramientas_digitales: {
    indicators: [
      'Usa computadora, correo, hojas de cálculo o aplicaciones de trabajo',
      'Aprende a usar nuevos programas o aplicaciones',
      'Envía y organiza información por medios digitales',
    ],
    examples: [
      'Manejo Word, Excel y el correo para mandar reportes',
      'Uso WhatsApp Business para responder a los clientes y mandar catálogos',
      'Ayudo a mis hijos con las tareas en la computadora y hago trámites en línea',
      'Aprendí solo a usar el sistema de la empresa para registrar ventas',
    ],
  },
  coordinacion: {
    indicators: [
      'Organiza tareas con otras personas y acuerda tiempos',
      'Hace seguimiento a encargos para que se cumplan',
      'Comunica cambios a las personas involucradas',
    ],
    examples: [
      'Organizaba los turnos de mis compañeros para que no faltara nadie',
      'Coordinaba con el proveedor y con almacén para que la entrega llegara a tiempo',
      'En la fiesta del barrio repartí las tareas y fui revisando que se hicieran',
      'Llamaba para confirmar las citas y avisaba si alguien cancelaba',
    ],
  },
  org_productos: {
    indicators: [
      'Ordena productos por tipo, marca, talla o fecha',
      'Ubica cada producto en un lugar donde se encuentra rápido',
      'Mantiene la exhibición ordenada y visible',
    ],
    examples: [
      'Acomodaba la mercadería en los estantes por marca y tamaño',
      'En la bodega pongo adelante lo que vence primero',
      'Ordeno la ropa por talla y color para que el cliente la vea',
      'En mi puesto del mercado separo las frutas por tipo y madurez',
    ],
  },
  control_existencias: {
    indicators: [
      'Cuenta productos y compara con lo registrado',
      'Detecta faltantes, sobrantes o productos vencidos',
      'Lleva el control de entradas y salidas de mercadería',
    ],
    examples: [
      'Contaba las cajas del almacén cada semana y anotaba lo que faltaba',
      'Revisaba las fechas de vencimiento y sacaba lo que ya no servía',
      'Sabía cuántas gaseosas quedaban en la bodega sin tener que contar todo',
      'Anotaba lo que entraba y salía del depósito en un cuaderno',
    ],
  },
  reposicion: {
    indicators: [
      'Repone productos en anaqueles o góndolas cuando se acaban',
      'Rota los productos para que salga primero lo más antiguo',
      'Mantiene los estantes llenos durante el día',
    ],
    examples: [
      'Cuando un estante se vaciaba traía más productos del depósito',
      'Llenaba las refrigeradoras de bebidas antes de la hora punta',
      'Ponía atrás lo nuevo y adelante lo que había llegado antes',
      'Reponía los panes en la vitrina cada vez que salía una tanda',
    ],
  },
  recepcion_mercaderia: {
    indicators: [
      'Recibe mercadería y verifica cantidades con la guía o pedido',
      'Revisa el estado de los productos al recibirlos',
      'Reporta diferencias o productos dañados',
    ],
    examples: [
      'Cuando llegaba el proveedor contaba las cajas y las comparaba con la guía',
      'Revisaba que los productos no vinieran golpeados antes de firmar',
      'Si faltaba algo lo anotaba y avisaba al encargado',
      'Recibía los pedidos de la distribuidora para la tienda de mi tía',
    ],
  },
  atencion_cliente: {
    indicators: [
      'Recibe a las personas con amabilidad y escucha lo que necesitan',
      'Resuelve dudas o reclamos con paciencia',
      'Orienta a la persona hacia lo que busca',
    ],
    examples: [
      'Atendía a los clientes con paciencia aunque estuvieran molestos',
      'Le explicaba a la señora dónde encontrar lo que buscaba',
      'Recibía a los visitantes y los llevaba con la persona indicada',
      'En la parroquia orientaba a la gente sobre los horarios y trámites',
    ],
  },
  comunicacion: {
    indicators: [
      'Explica las cosas con claridad y verifica que se entendieron',
      'Escucha y adapta su forma de hablar a la persona',
      'Transmite información correcta a otros',
    ],
    examples: [
      'Explicaba a los clientes cómo funcionaba el producto con palabras sencillas',
      'Le pasaba el reporte del turno a mi compañera para que supiera lo pendiente',
      'En las reuniones del comité explicaba los acuerdos a los vecinos',
      'Hablaba por teléfono con los clientes para resolver sus dudas',
    ],
  },
  ventas: {
    indicators: [
      'Ofrece productos según lo que necesita el cliente',
      'Destaca beneficios y cierra la venta',
      'Logra que los clientes vuelvan a comprar',
    ],
    examples: [
      'Vendía cosméticos por catálogo a mis vecinas y llegaba a mi meta',
      'Recomendaba el producto que mejor le convenía al cliente y lo convencía',
      'Vendía comida en la feria y la gente volvía por más',
      'Ofrecía un producto adicional cuando el cliente ya estaba comprando',
    ],
  },
  gestion_pedidos: {
    indicators: [
      'Toma pedidos con todos los datos necesarios',
      'Hace seguimiento hasta que el pedido se entrega',
      'Coordina la preparación y la entrega de pedidos',
    ],
    examples: [
      'Tomaba los pedidos por WhatsApp y anotaba dirección y forma de pago',
      'Revisaba que cada pedido saliera completo antes de mandarlo',
      'Recibía los encargos de tortas con fecha y detalle y cumplía la entrega',
      'Le pasaba los pedidos a la cocina y avisaba cuando estaban listos',
    ],
  },
  manejo_dinero: {
    indicators: [
      'Cobra y guarda el dinero con cuidado',
      'Cuadra la caja al final del día',
      'Detecta billetes falsos o diferencias de dinero',
    ],
    examples: [
      'Al cerrar contaba la plata de la caja y cuadraba con lo vendido',
      'Me daba cuenta cuando un billete era falso por la textura',
      'Manejaba el dinero de la junta de la cuadra y rendía cuentas',
      'Guardaba el sencillo separado por montos para dar vuelto rápido',
    ],
  },
  calculo_vuelto: {
    indicators: [
      'Calcula montos y vuelto con rapidez y exactitud',
      'Suma, resta y verifica cuentas mentalmente',
      'Revisa el cálculo antes de entregar el dinero',
    ],
    examples: [
      'Sacaba el vuelto mentalmente sin usar calculadora',
      'Sumaba rápido la cuenta de varios productos y decía el total',
      'Contaba el vuelto delante del cliente para que no hubiera error',
      'En la bodega de mi mamá calculaba los precios por kilo al toque',
    ],
  },
  medios_pago: {
    indicators: [
      'Cobra con distintos medios: efectivo, tarjeta, billeteras digitales',
      'Verifica que un pago digital se haya recibido',
      'Usa POS o terminales de pago',
    ],
    examples: [
      'Cobraba con Yape y Plin y revisaba que llegara la notificación',
      'Pasaba las tarjetas por el POS y entregaba el voucher',
      'En mi negocio acepto efectivo y transferencias',
      'Atendía el agente bancario de la bodega para depósitos y pagos',
    ],
  },
  registro_transacciones: {
    indicators: [
      'Registra cada venta, cobro o pago',
      'Emite comprobantes y guarda el registro',
      'Revisa que los registros cuadren con el dinero',
    ],
    examples: [
      'Anotaba cada venta del día en un cuaderno con el monto',
      'Emitía boletas en el sistema por cada compra',
      'Llevaba la cuenta de lo que me debían los clientes fiados',
      'Registraba los pagos de las cuotas de la asociación',
    ],
  },
};
