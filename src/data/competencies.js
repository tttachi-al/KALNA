/**
 * Catálogo de competencias de referencia de KALLPA.
 *
 * Son competencias INICIALES, relacionadas con las cinco ocupaciones del
 * proyecto. El chatbot solo las propone cuando aparecen en lo que la
 * persona cuenta: nunca se asumen por haber trabajado en una ocupación.
 *
 * Campos:
 *  - short:   nombre corto para pantallas pequeñas.
 *  - signals: expresiones regulares sobre texto normalizado
 *             (minúsculas, sin tildes). Las usa el motor de demostración.
 *             En producción, QVAC reemplazará esta detección por reglas.
 *  - bases:   competencias que sirven como BASE TRANSFERIBLE para esta
 *             (si la persona tiene una de ellas, le será más fácil aprenderla).
 *  - learn:   actividades de aprendizaje sugeridas (genéricas y de bajo costo).
 *  - ask:     pregunta para pedir un ejemplo concreto.
 */

export const FAMILIES = {
  organizacion: { id: 'organizacion', name: 'Organización', short: 'Organización' },
  inventario: { id: 'inventario', name: 'Inventario y abastecimiento', short: 'Inventario' },
  higiene: { id: 'higiene', name: 'Higiene y seguridad', short: 'Higiene y seguridad' },
  servicio: { id: 'servicio', name: 'Atención y ventas', short: 'Atención y ventas' },
  dinero: { id: 'dinero', name: 'Dinero y pagos', short: 'Dinero y pagos' },
  informacion: { id: 'informacion', name: 'Información y herramientas digitales', short: 'Información y digital' },
};

export const FAMILY_ORDER = ['organizacion', 'inventario', 'higiene', 'servicio', 'dinero', 'informacion'];

export const COMPETENCIES = {
  // ───────────── Personal de limpieza ─────────────
  org_materiales: {
    id: 'org_materiales',
    short: 'Org. de materiales',
    name: 'Organización de materiales',
    family: 'organizacion',
    description: 'Ordenar y ubicar materiales y equipos para trabajar rápido y sin pérdidas.',
    signals: [
      /\b(re)?(organi[zc]|orden|acomod|clasific|ubic|separ|etiquet(o|aba|amos|ar|ado|ados|ada|adas)\b)\w*\b[^.]{0,50}\b(material|utensilio|implemento|herramienta|carrito|escoba|trapeador|balde|insumo|deposito|cuarto de limpieza)/,
      /\b(material|utensilio|implemento|insumo)\w*[^.]{0,40}\b(ordenad|organizad|clasificad|etiquetad)/,
      /\b(carrito|cuarto|deposito) de limpieza\b/,
    ],
    bases: [
      { id: 'org_productos', why: 'Ordenar productos en estantes usa la misma lógica que ordenar materiales.' },
      { id: 'org_documentos', why: 'Clasificar documentos también es ubicar cada cosa en su lugar.' },
    ],
    ask: '¿Cómo organizas tus materiales? Cuéntame qué haces, dónde los guardas y cómo sabes dónde está cada cosa.',
    learn: [
      { type: 'practica', text: 'Arma un esquema simple de dónde va cada material y pégalo en tu zona de trabajo.' },
      { type: 'observa', text: 'Observa cómo un compañero con experiencia prepara su carrito o zona al iniciar el turno.' },
    ],
  },
  uso_productos: {
    id: 'uso_productos',
    short: 'Uso de productos',
    name: 'Uso adecuado de productos',
    family: 'higiene',
    description: 'Elegir, diluir y aplicar productos de limpieza de forma correcta y segura.',
    signals: [
      /\b(lejia|desinfect\w*|detergente|quimic\w*|dosific\w*|dilu\w*|limpiavidrios|ambientador|cera para pisos)\b/,
      /\bproductos? de limpieza\b/,
      /\bno mezcl\w*\b/,
    ],
    bases: [{ id: 'protocolos', why: 'Seguir protocolos te ayuda a usar cada producto según su indicación.' }],
    ask: 'Dame un ejemplo de cómo usas los productos: ¿cómo los preparas o diluyes y qué cuidados tienes?',
    learn: [
      { type: 'practica', text: 'Lee la etiqueta de 3 productos que conozcas y anota para qué sirve cada uno y qué no se debe mezclar.' },
      { type: 'curso', text: 'Busca un curso gratuito de limpieza y desinfección o de seguridad con productos químicos.' },
    ],
  },
  protocolos: {
    id: 'protocolos',
    short: 'Protocolos',
    name: 'Cumplimiento de protocolos',
    family: 'higiene',
    description: 'Seguir pasos, normas de higiene y de seguridad de manera constante.',
    signals: [
      /\b(protocolo|procedimiento|norma|bioseguridad|epp|guantes|mascarilla|checklist|reglamento)\w*/,
      /\b(senaliz\w*|piso mojado|lista de verificacion|higiene|medidas de seguridad|normas de seguridad|instrucciones)\b/,
    ],
    bases: [{ id: 'uso_productos', why: 'Quien usa bien los productos ya sigue indicaciones de seguridad.' }],
    ask: 'Cuéntame una vez en que seguiste un protocolo o norma. ¿Cuál era y qué pasos seguiste?',
    learn: [
      { type: 'practica', text: 'Escribe paso a paso una tarea que haces siempre igual; así demuestras que sigues un procedimiento.' },
      { type: 'curso', text: 'Busca un curso gratuito sobre seguridad y salud en el trabajo.' },
    ],
  },
  control_suministros: {
    id: 'control_suministros',
    short: 'Control de suministros',
    name: 'Control de suministros',
    family: 'inventario',
    description: 'Revisar qué insumos hay, cuáles faltan y avisar a tiempo para reponerlos.',
    signals: [
      /\b(suministro|insumo)s?\b/,
      /\b(revis|control|verific|cont)\w*\b[^.]{0,40}\b(material|papel|jabon|bolsas|productos de limpieza)/,
      /\b(aviso|avisaba|informo|informaba|pido|pedia|solicito|solicitaba|reporto|reportaba)\b[^.]{0,50}\b(repon\w*|reposicion|falta\w*|material\w*|papel|jabon)/,
      /\b(papel higienico|jabon liquido|bolsas de basura)\b/,
    ],
    bases: [
      { id: 'control_existencias', why: 'Llevar el stock de productos es muy parecido a controlar insumos.' },
      { id: 'reposicion', why: 'Quien repone productos ya revisa qué falta.' },
    ],
    ask: '¿Cómo controlas los insumos? Dame un ejemplo: qué revisas, cada cuánto y a quién avisas cuando algo falta.',
    learn: [
      { type: 'practica', text: 'Haz una lista semanal de insumos con tres columnas: hay, falta, pedido.' },
      { type: 'observa', text: 'Pregunta cómo se hace el pedido de insumos en tu lugar de trabajo y quién lo aprueba.' },
    ],
  },

  // ───────────── Auxiliar administrativo ─────────────
  org_documentos: {
    id: 'org_documentos',
    short: 'Org. de documentos',
    name: 'Organización de documentos',
    family: 'organizacion',
    description: 'Archivar, clasificar y encontrar documentos de forma ordenada.',
    signals: [/\b(archiv\w*|expediente\w*|folder\w*|file\b|files\b|carpeta\w*|documento\w*|tramite\w*|oficio\w*|memorando\w*)/],
    bases: [
      { id: 'org_materiales', why: 'Si ya ordenas materiales por tipo, puedes ordenar documentos por tipo y fecha.' },
      { id: 'org_productos', why: 'Clasificar productos por categoría se parece a clasificar documentos.' },
    ],
    ask: 'Cuéntame cómo ordenabas o guardabas documentos. ¿Qué tipo de papeles eran y cómo los encontrabas después?',
    learn: [
      { type: 'practica', text: 'Ordena tus documentos personales por tipo y fecha, y ponles una etiqueta clara.' },
      { type: 'curso', text: 'Busca un curso gratuito de gestión documental o archivo básico.' },
    ],
  },
  registro_info: {
    id: 'registro_info',
    short: 'Reg. de información',
    name: 'Registro de información',
    family: 'informacion',
    description: 'Anotar datos de forma clara y completa en cuadernos, formatos o sistemas.',
    signals: [
      /\b(registr|anot|digit|tipe)\w*\b(?![^.]{0,25}\b(venta|cobro|pago|caja)s?\b)/,
      /\b(base de datos|formulario|formato\w*|planilla|cuaderno de \w+|llen\w* (fichas|formatos|formularios|datos))\b/,
    ],
    bases: [
      { id: 'registro_transacciones', why: 'Registrar cobros con orden es muy parecido a registrar otro tipo de datos.' },
      { id: 'control_existencias', why: 'Anotar entradas y salidas de productos ya es registrar información.' },
    ],
    ask: '¿Qué información anotabas o registrabas? Dame un ejemplo: dónde lo anotabas y para qué servía.',
    learn: [
      { type: 'practica', text: 'Lleva durante una semana un registro simple (fecha, tarea, resultado) en un cuaderno o en el celular.' },
      { type: 'curso', text: 'Busca un curso gratuito de hojas de cálculo básicas.' },
    ],
  },
  herramientas_digitales: {
    id: 'herramientas_digitales',
    short: 'Herramientas digitales',
    name: 'Uso de herramientas digitales',
    family: 'informacion',
    description: 'Usar computadora, celular, correo, hojas de cálculo o sistemas para trabajar.',
    signals: [
      /\b(excel|word|power ?point|computador\w*|laptop|lector de codigos|correo\w*|email|e-mail|gmail|outlook|whatsapp|software|google|drive|hoja\w* de calculo|tablet|impresora|escaner|zoom|aplicativo\w*|internet)\b/,
      /\b(celular|sistema\w*|app|apps|aplicacion\w*)\b/,
    ],
    bases: [{ id: 'medios_pago', why: 'Si usas Yape, Plin o POS, ya manejas aplicaciones con seguridad.' }],
    ask: 'Cuéntame para qué usabas el celular, la computadora o algún sistema en tu trabajo. ¿Qué hacías exactamente?',
    learn: [
      { type: 'practica', text: 'Practica crear una tabla en una hoja de cálculo con nombres, fechas y montos.' },
      { type: 'practica', text: 'Envía un correo corto y formal a alguien de confianza para practicar.' },
      { type: 'curso', text: 'Busca un curso gratuito de herramientas digitales o de ofimática básica.' },
    ],
  },
  coordinacion: {
    id: 'coordinacion',
    short: 'Coordinación de tareas',
    name: 'Coordinación de tareas',
    family: 'informacion',
    description: 'Organizar tiempos, encargos y comunicación con otras personas o áreas.',
    signals: [
      /\b(coordin\w*|agend\w*|recordatorio\w*|cronograma)\b/,
      /\b(program|organi[zc])\w*\b[^.]{0,20}\b(reunion|cita|visita|turno|entrega|horario)/,
      /\b(distribu|asign|repart)\w*\b[^.]{0,15}\btareas\b/,
    ],
    bases: [{ id: 'gestion_pedidos', why: 'Organizar pedidos implica coordinar tiempos, personas y entregas.' }],
    ask: 'Dame un ejemplo de una vez que coordinaste algo con otras personas: ¿qué organizaste y cómo salió?',
    learn: [
      { type: 'practica', text: 'Usa una agenda (papel o celular) para planificar tus tareas de la semana.' },
      { type: 'observa', text: 'Ofrece apoyo para organizar una reunión o un turno y anota qué pasos seguiste.' },
    ],
  },

  // ───────────── Reponedores y abastecedores ─────────────
  org_productos: {
    id: 'org_productos',
    short: 'Org. de productos',
    name: 'Organización de productos',
    family: 'organizacion',
    description: 'Ordenar y exhibir productos para que se vean bien y se encuentren fácil.',
    signals: [
      /\b(exhib\w*|gondola\w*|anaquel\w*|percha\w*|vitrina\w*|rotacion|fifo|frente(o|ar|aba))\b/,
      /\b(primero (que|en) vence|fechas? de vencimiento)\b/,
      /\b(re)?(acomod|orden|organi[zc]|clasific)\w*\b[^.]{0,30}\bproductos?\b(?! de limpieza)/,
      /\bproductos?\b(?! de limpieza)[^.]{0,30}\b(por tipo|por marca|por categoria|ordenad)/,
    ],
    bases: [
      { id: 'org_materiales', why: 'Ordenar materiales por tipo es la base para ordenar productos en estantes.' },
      { id: 'org_documentos', why: 'Clasificar documentos por tipo usa la misma lógica que clasificar productos.' },
    ],
    ask: '¿Cómo ordenabas los productos? Cuéntame un ejemplo: por qué criterio los acomodabas y por qué.',
    learn: [
      { type: 'practica', text: 'Practica la regla “lo primero que vence, sale primero” ordenando alimentos en casa.' },
      { type: 'observa', text: 'Visita una tienda o mercado y fíjate cómo están ordenados los productos y por qué.' },
    ],
  },
  control_existencias: {
    id: 'control_existencias',
    short: 'Control de existencias',
    name: 'Control de existencias',
    family: 'inventario',
    description: 'Contar productos, detectar faltantes y llevar el stock al día.',
    signals: [
      /\b(stock|inventario\w*|existencia\w*|conteo\w*|kardex|faltante\w*|sobrante\w*|quiebre)\b/,
      /\bcont(e|ar|aba|abamos|amos|aba)\b[^.]{0,30}\b(producto|mercaderia|cajas|unidades)/,
      /\bproductos? que falta/,
    ],
    bases: [
      { id: 'control_suministros', why: 'Revisar qué insumos faltan y avisar es la base del control de stock.' },
      { id: 'registro_info', why: 'Anotar datos con orden te ayuda a llevar entradas y salidas.' },
    ],
    ask: 'Dame un ejemplo de cómo contabas o controlabas productos: ¿cada cuánto, cómo lo anotabas y qué hacías si faltaba algo?',
    learn: [
      { type: 'practica', text: 'Haz una tabla de entradas, salidas y saldo con 5 productos y actualízala por una semana.' },
      { type: 'curso', text: 'Busca un curso gratuito de control de inventarios o almacén básico.' },
    ],
  },
  reposicion: {
    id: 'reposicion',
    short: 'Reposición',
    name: 'Reposición de productos',
    family: 'inventario',
    description: 'Reponer a tiempo los productos en estantes o zonas de venta.',
    signals: [
      /\b(repong|reponi|repus|repon(er|emos|iendo))\w*\b[^.]{0,40}\b(estante|anaquel|gondola|percha|vitrina|producto|mercaderia|exhibidor|refrigerador)/,
      /\b(reabastec|abastec|surt)\w*\b/,
      /\bllen\w*\b[^.]{0,20}\b(estante|anaquel|gondola|percha|vitrina)/,
    ],
    bases: [{ id: 'control_suministros', why: 'Quien controla insumos ya sabe detectar lo que hay que reponer.' }],
    ask: 'Cuéntame cómo reponías productos: ¿cómo sabías qué faltaba y en qué orden lo hacías?',
    learn: [
      { type: 'observa', text: 'Pregunta en una tienda cuándo se repone (antes de abrir, por turnos) y cómo se decide.' },
      { type: 'practica', text: 'Practica revisar un estante y anotar qué falta antes de reponer.' },
    ],
  },
  recepcion_mercaderia: {
    id: 'recepcion_mercaderia',
    short: 'Recepción de mercadería',
    name: 'Recepción de mercadería',
    family: 'inventario',
    description: 'Recibir pedidos de proveedores verificando cantidades, estado y documentos.',
    signals: [
      /\b(recepcion|recepcionar|recepciono|recepcionaba)\b/,
      /\brecib\w*\b[^.]{0,30}\b(mercaderia|camion|proveedor\w*|carga|cajas)/,
      /\b(guia\w* de remision|descarg\w*)\b/,
      /\bverific\w*\b[^.]{0,30}\b(cantidad\w*|mercaderia|lo que llega)/,
    ],
    bases: [
      { id: 'control_suministros', why: 'Si revisas insumos, ya sabes comprobar si llegó lo que se pidió.' },
      { id: 'registro_info', why: 'Anotar datos con cuidado ayuda a verificar guías y cantidades.' },
    ],
    ask: '¿Recibías mercadería o pedidos de proveedores? Cuéntame qué revisabas cuando llegaba.',
    learn: [
      { type: 'observa', text: 'Pide acompañar a quien recibe la mercadería y fíjate qué documentos revisa.' },
      { type: 'curso', text: 'Busca un curso gratuito de almacén o logística básica.' },
    ],
  },

  // ───────────── Vendedores de tienda ─────────────
  atencion_cliente: {
    id: 'atencion_cliente',
    short: 'Atención al cliente',
    name: 'Atención al cliente',
    family: 'servicio',
    description: 'Atender con amabilidad, resolver dudas y cuidar la experiencia del cliente.',
    signals: [/\b(client\w*|atiend\w*|atend\w*|atencion|publico|usuari\w*|queja\w*|reclamo\w*|comprador\w*)\b/],
    bases: [{ id: 'comunicacion', why: 'Comunicarte con claridad es la base para atender bien a un cliente.' }],
    ask: 'Cuéntame una vez en que atendiste a un cliente o a una persona del público. ¿Qué necesitaba y qué hiciste?',
    learn: [
      { type: 'practica', text: 'Practica saludar, escuchar y confirmar lo que la persona necesita antes de responder.' },
      { type: 'curso', text: 'Busca un curso gratuito de atención al cliente.' },
    ],
  },
  comunicacion: {
    id: 'comunicacion',
    short: 'Comunicación',
    name: 'Comunicación',
    family: 'servicio',
    description: 'Explicar, escuchar y dar información clara a clientes y compañeros.',
    signals: [
      /\b(explic\w*|convers\w*|escuch\w*|recomiend\w*|recomend\w*|amable|amabilidad|trato|dialog\w*|comunic\w*|convenc\w*|aconsej\w*|asesor\w*)\b/,
      /\b(ensen\w*|capacit\w*)\b/,
    ],
    bases: [{ id: 'atencion_cliente', why: 'Atender personas ya te obliga a explicar y escuchar con claridad.' }],
    ask: 'Dame un ejemplo de una vez que tuviste que explicar algo a alguien. ¿Cómo lo hiciste para que te entienda?',
    learn: [
      { type: 'practica', text: 'Explica una tarea de tu trabajo a alguien en 1 minuto y pregúntale qué entendió.' },
      { type: 'observa', text: 'Fíjate cómo un buen vendedor pregunta antes de recomendar.' },
    ],
  },
  ventas: {
    id: 'ventas',
    short: 'Ventas',
    name: 'Ventas',
    family: 'servicio',
    description: 'Ofrecer productos, mostrar sus beneficios y cerrar una venta.',
    signals: [
      /\b(vend(o|es|e|emos|en|ia|ian|iamos|er|iendo|ido|ida|i|io)|ventas?|ofrez\w*|ofrec\w*|promocion\w*|ofertas?)\b/,
      /\b(meta\w* de venta|cerr\w* (la|una) venta|catalogo\w*)\b/,
    ],
    bases: [
      { id: 'atencion_cliente', why: 'Si atiendes bien a las personas, ya tienes la mitad de una buena venta.' },
      { id: 'comunicacion', why: 'Explicar con claridad ayuda a mostrar los beneficios de un producto.' },
    ],
    ask: 'Cuéntame una venta que recuerdes: ¿qué ofreciste, qué te preguntó el cliente y cómo terminó?',
    learn: [
      { type: 'practica', text: 'Prepara cómo presentarías 3 productos: qué es, para qué sirve y por qué conviene.' },
      { type: 'curso', text: 'Busca un curso gratuito de técnicas de venta.' },
    ],
  },
  gestion_pedidos: {
    id: 'gestion_pedidos',
    short: 'Gestión de pedidos',
    name: 'Gestión de pedidos',
    family: 'servicio',
    description: 'Tomar, separar, hacer seguimiento y entregar pedidos de clientes.',
    signals: [
      /\b(pedido\w*|encargo\w*|delivery|despach\w*|reserva\w*)\b/,
      /\bsepar\w*\b[^.]{0,20}\b(producto|pedido|mercaderia)/,
    ],
    bases: [{ id: 'coordinacion', why: 'Coordinar tareas y tiempos es la base para cumplir con un pedido.' }],
    ask: '¿Cómo manejabas los pedidos? Dame un ejemplo: cómo lo tomabas, cómo lo anotabas y cómo lo entregabas.',
    learn: [
      { type: 'practica', text: 'Crea una hoja de pedidos con: fecha, cliente, producto, cantidad y estado.' },
      { type: 'observa', text: 'Fíjate cómo una tienda confirma los pedidos por WhatsApp o por teléfono.' },
    ],
  },

  // ───────────── Cajeros ─────────────
  manejo_dinero: {
    id: 'manejo_dinero',
    short: 'Manejo de dinero',
    name: 'Manejo de dinero',
    family: 'dinero',
    description: 'Recibir, contar y cuidar el dinero con exactitud y honestidad.',
    signals: [
      /\b(dinero|efectivo|billete\w*|caja chica|plata|fondo de caja|sencillo|monedas)\b/,
      /\bcobr\w*\b/,
      /\bdeposit\w*\b[^.]{0,20}\b(banco|dinero)/,
    ],
    bases: [{ id: 'calculo_vuelto', why: 'Si calculas vueltos sin errores, ya cuidas el dinero con exactitud.' }],
    ask: 'Cuéntame cómo manejabas el dinero: ¿cuánto aproximadamente, cómo lo contabas y cómo evitabas errores?',
    learn: [
      { type: 'practica', text: 'Practica contar billetes y monedas rápido y en orden, de mayor a menor valor.' },
      { type: 'observa', text: 'Aprende a revisar las señales de seguridad de los billetes.' },
    ],
  },
  calculo_vuelto: {
    id: 'calculo_vuelto',
    short: 'Cálculo de vuelto',
    name: 'Cálculo de vuelto',
    family: 'dinero',
    description: 'Sumar, restar y entregar el vuelto correcto con rapidez.',
    signals: [
      /\bvuelto\w*\b/,
      /\bcalcul\w*\b[^.]{0,20}\b(total|monto|cuenta|precio|descuento)/,
      /\bsum\w*\b[^.]{0,20}\b(monto|precio|cuenta|total)/,
      /\b(sacar la cuenta|dar cambio|cambio exacto|calculadora)\b/,
    ],
    bases: [{ id: 'manejo_dinero', why: 'Quien maneja dinero ya hace cálculos todos los días.' }],
    ask: 'Dame un ejemplo de cómo calculabas el total o el vuelto. ¿Lo hacías de memoria, con calculadora o con el sistema?',
    learn: [
      { type: 'practica', text: 'Practica 10 ejemplos de vuelto al día: precio, pago y cuánto devolver.' },
      { type: 'practica', text: 'Practica calcular descuentos simples, como 10 % o 20 %.' },
    ],
  },
  medios_pago: {
    id: 'medios_pago',
    short: 'Medios de pago',
    name: 'Medios de pago',
    family: 'dinero',
    description: 'Cobrar con efectivo, POS, tarjetas, transferencias y billeteras digitales.',
    signals: [/\b(pos|tarjeta\w*|yape\w*|plin|transferencia\w*|qr|billetera\w*|visa|mastercard|niubiz|izipay|datafono)\b/, /\bpagos? digital\w*\b/],
    bases: [{ id: 'herramientas_digitales', why: 'Si ya usas el celular o aplicaciones, aprender POS, Yape o Plin es más fácil.' }],
    ask: '¿Qué medios de pago usabas? Cuéntame cómo confirmabas que un pago con tarjeta o billetera digital había llegado.',
    learn: [
      { type: 'practica', text: 'Aprende a confirmar un pago con Yape o Plin revisando el nombre, monto y código.' },
      { type: 'observa', text: 'Pide que te muestren cómo funciona un POS: cobro, anulación y cierre.' },
    ],
  },
  registro_transacciones: {
    id: 'registro_transacciones',
    short: 'Reg. de transacciones',
    name: 'Registro de transacciones',
    family: 'dinero',
    description: 'Registrar ventas y cobros, emitir comprobantes y cuadrar la caja.',
    signals: [
      /\b(cuadr\w*|arqueo\w*|cierre de caja|apertura de caja|caja registradora|boleta\w*|comprobante\w*|ticket\w*|factur\w*)\b/,
      /\b(abr|cerr)\w*\b (la )?caja\b/,
      /\b(registr|anot)\w*\b[^.]{0,25}\b(venta|cobro|pago|transaccion|operacion)\w*/,
    ],
    bases: [{ id: 'registro_info', why: 'Si registras información con orden, aprender a registrar cobros es más sencillo.' }],
    ask: 'Cuéntame cómo registrabas los cobros o cuadrabas la caja. ¿Qué hacías si algo no cuadraba?',
    learn: [
      { type: 'practica', text: 'Practica un cuadre de caja con un ejemplo: monto inicial + ventas − retiros = monto final.' },
      { type: 'curso', text: 'Busca un curso gratuito de caja y atención en punto de venta.' },
    ],
  },
};

export const COMPETENCY_IDS = Object.keys(COMPETENCIES);
export const getCompetency = (id) => COMPETENCIES[id];

/** Ocupaciones que requieren una competencia (se calcula a partir de occupations.js). */
export function occupationsForCompetency(id, occupations) {
  return Object.values(occupations)
    .filter((o) => o.requires.some((r) => r.id === id))
    .map((o) => o.id);
}
