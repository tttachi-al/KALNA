/**
 * Catálogo SINTÉTICO de empleos de KALLPA (`sintetico-v2`, 50 empleos seleccionados de v1;
 * ver docs/catalogo-sintetico-seleccion.md): una sola
 * colección plana de 50 empleos distintos, de sectores, niveles y tipos de
 * actividad variados. No se agrupa por perfiles, sectores ni categorías:
 * sector, nivel y requisitos son solo atributos de cada empleo.
 *
 * Campos:
 *  - id, title, description
 *  - tasks:            funciones principales
 *  - responsibilities: responsabilidades
 *  - competencies:     competencias requeridas (ids de src/data/competencies.js),
 *                      weight 'clave' | 'complementaria'
 *  - requirements:     requisitos laborales { kind, text, mandatory }
 *                      kind: educacion · experiencia · certificacion · licencia · formacion · condicion
 *  - sector, level:    atributos descriptivos (level: operativo · tecnico · supervision)
 *
 * Son ejemplos SINTÉTICOS de referencia, no vacantes: no tienen empresa,
 * fecha ni enlace, y no deben mostrarse como ofertas disponibles.
 */
export const SYNTHETIC_JOBS = [
  {
    id: 'sint_abastecedor_grifo_tienda',
    title: 'Abastecedor(a) de tienda de conveniencia',
    sector: 'Retail',
    level: 'operativo',
    description:
      'Repone góndolas y refrigeradoras de una tienda de conveniencia, recibe a proveedores, controla vencimientos y apoya en caja cuando hay mucha afluencia.',
    tasks: [
      'Reponer góndolas y refrigeradoras',
      'Recibir proveedores',
      'Retirar productos vencidos',
      'Apoyar en caja',
    ],
    responsibilities: ['Mantener la tienda abastecida', 'Controlar vencimientos'],
    competencies: [
      { id: 'reposicion', weight: 'clave' },
      { id: 'recepcion_mercaderia', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'manejo_dinero', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'condicion', text: 'Turnos rotativos, incluso nocturnos', mandatory: false },
    ],
  },
  {
    id: 'sint_admision_clinica',
    title: 'Asistente de admisión en clínica',
    sector: 'Salud',
    level: 'operativo',
    description:
      'Registra a pacientes, verifica su cobertura o seguro, asigna citas y orienta sobre los pasos de atención, en coordinación con el personal de salud.',
    tasks: [
      'Registrar datos de pacientes',
      'Verificar coberturas de seguros',
      'Asignar y confirmar citas',
      'Orientar sobre trámites',
    ],
    responsibilities: ['Proteger datos personales de pacientes', 'Atender con empatía'],
    competencies: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'coordinacion', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Secundaria completa; algunos centros piden estudios técnicos',
        mandatory: true,
      },
      { kind: 'experiencia', text: 'Experiencia en atención al público', mandatory: false },
    ],
  },
  {
    id: 'sint_agente_corresponsal',
    title: 'Operador(a) de agente corresponsal bancario',
    sector: 'Servicios financieros',
    level: 'operativo',
    description:
      'Atiende operaciones de un agente bancario dentro de un negocio (depósitos, pagos de servicios, retiros) con un terminal, y lleva el control del efectivo del agente.',
    tasks: [
      'Operar el terminal del agente',
      'Recibir pagos y depósitos',
      'Controlar el efectivo del agente',
      'Entregar comprobantes',
    ],
    responsibilities: ['Cuidar el efectivo', 'Operar sin errores'],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'medios_pago', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'calculo_vuelto', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en el uso del terminal (la brinda la entidad)',
        mandatory: true,
      },
    ],
  },
  {
    id: 'sint_agente_inmobiliario',
    title: 'Asesor(a) inmobiliario junior',
    sector: 'Inmobiliario',
    level: 'tecnico',
    description:
      'Muestra inmuebles a interesados, explica características y condiciones, hace seguimiento a prospectos y apoya en la documentación de la operación.',
    tasks: [
      'Mostrar inmuebles',
      'Hacer seguimiento a prospectos',
      'Explicar condiciones de compra o alquiler',
      'Apoyar en documentos',
    ],
    responsibilities: ['Informar con transparencia', 'Cumplir la normativa del sector'],
    competencies: [
      { id: 'ventas', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'org_documentos', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'certificacion',
        text: 'Registro como agente inmobiliario exigido por la normativa del sector (por verificar en cada caso)',
        mandatory: true,
      },
      { kind: 'condicion', text: 'Pago principalmente por comisiones', mandatory: false },
    ],
  },
  {
    id: 'sint_archivo',
    title: 'Asistente de archivo y gestión documental',
    sector: 'Servicios empresariales',
    level: 'operativo',
    description:
      'Clasifica, codifica y archiva documentos físicos y digitales siguiendo un sistema de archivo, y atiende pedidos de búsqueda y préstamo de expedientes. Puede apoyar en la digitalización de archivos.',
    tasks: [
      'Clasificar y codificar documentos',
      'Archivar expedientes',
      'Atender búsquedas y préstamos',
      'Digitalizar documentos',
    ],
    responsibilities: [
      'Mantener el archivo ordenado y ubicable',
      'Registrar préstamos y devoluciones',
    ],
    competencies: [
      { id: 'org_documentos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Conocimiento de técnicas de archivo (deseable)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_asistente_compras',
    title: 'Asistente de compras',
    sector: 'Comercio y servicios',
    level: 'operativo',
    description:
      'Solicita cotizaciones, compara precios, emite órdenes de compra y hace seguimiento a la entrega de los pedidos a proveedores, manteniendo un registro actualizado.',
    tasks: [
      'Solicitar cotizaciones',
      'Emitir órdenes de compra',
      'Hacer seguimiento a proveedores',
      'Registrar compras y entregas',
    ],
    responsibilities: ['Comprar a tiempo lo que se necesita', 'Mantener el registro de compras'],
    competencies: [
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'control_suministros', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'formacion', text: 'Excel básico y correo', mandatory: true },
      {
        kind: 'educacion',
        text: 'Estudios técnicos en administración (deseable)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_asistente_rrhh',
    title: 'Asistente de recursos humanos',
    sector: 'Servicios empresariales',
    level: 'tecnico',
    description:
      'Apoya en el control de asistencia, la organización de legajos del personal, el ingreso de datos para planillas y la coordinación de procesos de selección e inducción.',
    tasks: [
      'Organizar legajos del personal',
      'Registrar asistencia y descansos',
      'Coordinar entrevistas',
      'Preparar documentos de ingreso',
    ],
    responsibilities: ['Manejar información confidencial', 'Cumplir plazos de planilla'],
    competencies: [
      { id: 'org_documentos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Estudios técnicos o universitarios en administración o afines (en curso o concluidos)',
        mandatory: true,
      },
      { kind: 'formacion', text: 'Conocimiento básico de normativa laboral', mandatory: false },
    ],
  },
  {
    id: 'sint_asistente_supervisor_almacen',
    title: 'Asistente de supervisión de almacén',
    sector: 'Logística',
    level: 'supervision',
    description:
      'Apoya al jefe de almacén en la programación de recepciones y despachos, el control de inventarios y la coordinación del personal operativo por turno.',
    tasks: [
      'Programar recepciones y despachos',
      'Revisar indicadores de inventario',
      'Coordinar al personal del turno',
      'Preparar reportes',
    ],
    responsibilities: ['Cumplir la programación del almacén', 'Asegurar el orden y la seguridad'],
    competencies: [
      { id: 'coordinacion', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'recepcion_mercaderia', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'experiencia', text: 'Dos años o más en almacén', mandatory: true },
      { kind: 'formacion', text: 'Excel intermedio', mandatory: true },
      { kind: 'educacion', text: 'Estudios técnicos en logística (deseable)', mandatory: false },
    ],
  },
  {
    id: 'sint_atencion_redes',
    title: 'Asesor(a) de atención por chat y redes sociales',
    sector: 'Comercio electrónico',
    level: 'operativo',
    description:
      'Responde consultas de clientes por WhatsApp, chat web y redes sociales, registra pedidos o reclamos en el sistema y hace seguimiento hasta su resolución.',
    tasks: [
      'Responder mensajes de clientes',
      'Registrar pedidos y reclamos',
      'Hacer seguimiento a casos',
      'Usar respuestas tipo y plantillas',
    ],
    responsibilities: [
      'Responder en los tiempos definidos',
      'Escribir con claridad y buena ortografía',
    ],
    competencies: [
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'gestion_pedidos', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Redacción clara y manejo de aplicaciones de mensajería empresarial',
        mandatory: true,
      },
      { kind: 'condicion', text: 'Trabajo remoto o híbrido en algunos casos', mandatory: false },
    ],
  },
  {
    id: 'sint_auxiliar_almacen',
    title: 'Auxiliar de almacén',
    sector: 'Logística',
    level: 'operativo',
    description:
      'Recibe, ubica y despacha mercadería en un almacén, controlando entradas y salidas con guías o sistemas y manteniendo el orden por zonas y fechas.',
    tasks: [
      'Recibir y verificar mercadería',
      'Ubicar productos por zonas',
      'Preparar despachos',
      'Registrar entradas y salidas',
    ],
    responsibilities: ['Mantener el stock ordenado y ubicable', 'Reportar faltantes o daños'],
    competencies: [
      { id: 'recepcion_mercaderia', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'protocolos', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'educacion', text: 'Secundaria completa', mandatory: false },
      { kind: 'condicion', text: 'Esfuerzo físico moderado', mandatory: false },
    ],
  },
  {
    id: 'sint_auxiliar_cobranzas',
    title: 'Auxiliar de cobranzas',
    sector: 'Servicios empresariales',
    level: 'operativo',
    description:
      'Contacta a clientes con pagos pendientes, registra compromisos de pago, aplica los pagos recibidos y mantiene actualizado el estado de cuenta.',
    tasks: [
      'Contactar clientes con deuda',
      'Registrar compromisos',
      'Aplicar pagos recibidos',
      'Actualizar estados de cuenta',
    ],
    responsibilities: ['Comunicar con respeto', 'Registrar con exactitud'],
    competencies: [
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'medios_pago', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'formacion', text: 'Excel básico', mandatory: true },
      {
        kind: 'educacion',
        text: 'Estudios técnicos en administración o contabilidad (deseable)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_auxiliar_contable',
    title: 'Auxiliar contable',
    sector: 'Servicios contables',
    level: 'tecnico',
    description:
      'Registra comprobantes de compras y ventas, ordena la documentación contable y apoya en conciliaciones bancarias y declaraciones mensuales bajo supervisión de un contador.',
    tasks: [
      'Registrar comprobantes en el sistema contable',
      'Ordenar y archivar documentación',
      'Apoyar en conciliaciones bancarias',
      'Preparar reportes simples',
    ],
    responsibilities: ['Registrar con exactitud', 'Cumplir los plazos tributarios'],
    competencies: [
      { id: 'registro_info', weight: 'clave' },
      { id: 'org_documentos', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Estudios técnicos en contabilidad (en curso o concluidos)',
        mandatory: true,
      },
      { kind: 'formacion', text: 'Excel intermedio', mandatory: true },
    ],
  },
  {
    id: 'sint_auxiliar_despacho',
    title: 'Auxiliar de despacho',
    sector: 'Logística',
    level: 'operativo',
    description:
      'Prepara y verifica pedidos para su salida, embala y rotula paquetes y coordina con transportistas la entrega, registrando cada despacho.',
    tasks: [
      'Armar pedidos según orden',
      'Embalar y rotular',
      'Verificar cantidades antes de la salida',
      'Coordinar con transportistas',
    ],
    responsibilities: ['Despachar sin errores', 'Cumplir horarios de salida'],
    competencies: [
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'coordinacion', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
      { id: 'control_existencias', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'condicion',
        text: 'Turnos tempranos o nocturnos según la operación',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_auxiliar_farmacia',
    title: 'Auxiliar de farmacia o botica',
    sector: 'Salud y retail farmacéutico',
    level: 'operativo',
    description:
      'Atiende a clientes en botica, despacha productos según la indicación del químico farmacéutico, repone anaqueles y controla vencimientos.',
    tasks: [
      'Atender y despachar productos',
      'Reponer anaqueles',
      'Controlar vencimientos',
      'Registrar ventas',
    ],
    responsibilities: [
      'Respetar la dispensación indicada por el químico farmacéutico',
      'Mantener el stock ordenado',
    ],
    competencies: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'control_existencias', weight: 'complementaria' },
      { id: 'registro_transacciones', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Estudios técnicos en farmacia (frecuentes en avisos)',
        mandatory: true,
      },
      { kind: 'experiencia', text: 'Experiencia en boticas', mandatory: false },
    ],
  },
  {
    id: 'sint_auxiliar_tesoreria',
    title: 'Auxiliar de tesorería',
    sector: 'Servicios empresariales',
    level: 'tecnico',
    description:
      'Registra los ingresos y egresos de dinero de una empresa, prepara los pagos a proveedores, controla el fondo de caja chica y apoya en las conciliaciones bancarias bajo la supervisión del área de finanzas.',
    tasks: [
      'Registrar ingresos y egresos',
      'Preparar pagos a proveedores',
      'Controlar la caja chica',
      'Apoyar en conciliaciones',
    ],
    responsibilities: ['Registrar con exactitud', 'Custodiar documentos y valores'],
    competencies: [
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'org_documentos', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Estudios técnicos en contabilidad o administración',
        mandatory: true,
      },
      { kind: 'formacion', text: 'Excel intermedio', mandatory: true },
    ],
  },
  {
    id: 'sint_ayudante_cocina',
    title: 'Ayudante de cocina',
    sector: 'Gastronomía',
    level: 'operativo',
    description:
      'Apoya al cocinero en la preparación previa de alimentos, la limpieza de utensilios y el orden de la cocina, siguiendo buenas prácticas de manipulación. Controla que no falten insumos para el servicio.',
    tasks: [
      'Lavar, pelar y cortar insumos',
      'Limpiar y ordenar la cocina y utensilios',
      'Rotular y guardar alimentos',
      'Avisar qué insumos faltan',
    ],
    responsibilities: [
      'Cumplir buenas prácticas de manipulación de alimentos',
      'Mantener la cocina ordenada durante el servicio',
    ],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'control_suministros', weight: 'clave' },
      { id: 'coordinacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en buenas prácticas de manipulación de alimentos',
        mandatory: true,
      },
      { kind: 'condicion', text: 'Turnos en horario de almuerzo y cena', mandatory: false },
    ],
  },
  {
    id: 'sint_ayudante_mantenimiento',
    title: 'Ayudante de mantenimiento general',
    sector: 'Servicios generales',
    level: 'operativo',
    description:
      'Apoya en reparaciones menores de gasfitería, electricidad básica y pintura en edificios, colegios o empresas, además de la limpieza posterior al trabajo. Cuida y ordena las herramientas.',
    tasks: [
      'Apoyar en reparaciones menores',
      'Pintar y resanar paredes',
      'Ordenar y cuidar herramientas',
      'Limpiar el área tras el trabajo',
    ],
    responsibilities: ['Usar herramientas con seguridad', 'Reportar fallas que encuentre'],
    competencies: [
      { id: 'org_materiales', weight: 'clave' },
      { id: 'protocolos', weight: 'clave' },
      { id: 'control_suministros', weight: 'complementaria' },
      { id: 'coordinacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Conocimientos básicos de oficios (gasfitería, pintura) o disposición a aprender',
        mandatory: true,
      },
      { kind: 'experiencia', text: 'Experiencia en mantenimiento', mandatory: false },
    ],
  },
  {
    id: 'sint_barista',
    title: 'Barista',
    sector: 'Gastronomía',
    level: 'operativo',
    description:
      'Prepara bebidas a base de café y otras, atiende al cliente en barra, toma pedidos y mantiene limpia la estación de trabajo.',
    tasks: [
      'Preparar bebidas',
      'Tomar pedidos en barra',
      'Recomendar productos',
      'Limpiar la estación',
    ],
    responsibilities: ['Mantener la calidad de las bebidas', 'Atender con amabilidad'],
    competencies: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'ventas', weight: 'complementaria' },
      { id: 'protocolos', weight: 'complementaria' },
      { id: 'manejo_dinero', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Curso o capacitación en preparación de café (la brindan muchas cafeterías)',
        mandatory: true,
      },
      { kind: 'formacion', text: 'Manipulación de alimentos', mandatory: false },
    ],
  },
  {
    id: 'sint_cajero_supermercado',
    title: 'Cajero(a) de supermercado',
    sector: 'Retail',
    level: 'operativo',
    description:
      'Registra productos, cobra con distintos medios de pago, entrega vuelto y comprobante y cuadra la caja al final del turno en un supermercado con alto flujo de clientes.',
    tasks: [
      'Registrar productos',
      'Cobrar con efectivo, tarjeta y billeteras',
      'Entregar vuelto y comprobante',
      'Cuadrar la caja',
    ],
    responsibilities: ['Cuadrar sin diferencias', 'Atender con rapidez'],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'calculo_vuelto', weight: 'clave' },
      { id: 'medios_pago', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'educacion', text: 'Secundaria completa', mandatory: true },
      { kind: 'condicion', text: 'Turnos rotativos y fines de semana', mandatory: false },
    ],
  },
  {
    id: 'sint_call_center',
    title: 'Asesor(a) de atención telefónica',
    sector: 'Telecomunicaciones y servicios',
    level: 'operativo',
    description:
      'Atiende consultas, reclamos o solicitudes de clientes por teléfono, registrando cada caso en el sistema y siguiendo guiones y tiempos de atención. Trabaja con indicadores de calidad.',
    tasks: [
      'Atender llamadas entrantes',
      'Registrar casos en el sistema',
      'Resolver consultas frecuentes',
      'Derivar casos complejos',
    ],
    responsibilities: ['Cumplir tiempos y calidad de atención', 'Registrar cada interacción'],
    competencies: [
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'educacion', text: 'Secundaria completa', mandatory: true },
      { kind: 'condicion', text: 'Turnos rotativos y trabajo por indicadores', mandatory: false },
    ],
  },
  {
    id: 'sint_camara_frio',
    title: 'Operario(a) de cámara de frío',
    sector: 'Logística de alimentos',
    level: 'operativo',
    description:
      'Recibe, almacena y despacha productos refrigerados o congelados respetando la cadena de frío, con rotación por fecha y control de temperaturas.',
    tasks: [
      'Recibir productos refrigerados',
      'Controlar temperaturas',
      'Rotar por fecha de vencimiento',
      'Despachar pedidos',
    ],
    responsibilities: ['Mantener la cadena de frío', 'Trabajar con protección térmica'],
    competencies: [
      { id: 'control_existencias', weight: 'clave' },
      { id: 'protocolos', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'recepcion_mercaderia', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'condicion',
        text: 'Trabajo en ambientes de baja temperatura con equipo térmico',
        mandatory: true,
      },
      { kind: 'formacion', text: 'Capacitación en cadena de frío', mandatory: false },
    ],
  },
  {
    id: 'sint_camarera_pisos',
    title: 'Camarero(a) de pisos en hotel',
    sector: 'Hotelería y turismo',
    level: 'operativo',
    description:
      'Prepara y limpia habitaciones de hotel para la llegada de huéspedes: cambia ropa de cama, repone amenidades y revisa que todo funcione. Trabaja con estándares de presentación y trato discreto con los huéspedes.',
    tasks: [
      'Limpiar y ordenar habitaciones',
      'Cambiar sábanas y toallas',
      'Reponer amenidades y minibar',
      'Reportar daños u objetos olvidados',
    ],
    responsibilities: [
      'Cumplir el estándar de presentación del hotel',
      'Controlar los insumos del carrito',
    ],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'control_suministros', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'org_materiales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'experiencia', text: 'Experiencia en limpieza o en hotelería', mandatory: false },
      { kind: 'condicion', text: 'Disponibilidad fines de semana y feriados', mandatory: false },
    ],
  },
  {
    id: 'sint_casa_cambio',
    title: 'Cajero(a) de casa de cambio',
    sector: 'Servicios financieros',
    level: 'operativo',
    description:
      'Compra y vende moneda extranjera en ventanilla, verifica la autenticidad de billetes, calcula montos según el tipo de cambio y registra cada operación.',
    tasks: [
      'Comprar y vender divisas',
      'Verificar billetes',
      'Calcular montos',
      'Registrar operaciones',
    ],
    responsibilities: [
      'Detectar billetes falsos',
      'Cumplir normas de prevención de lavado de activos',
    ],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'calculo_vuelto', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en detección de billetes falsos y prevención de lavado de activos',
        mandatory: true,
      },
      { kind: 'condicion', text: 'Verificación de antecedentes', mandatory: true },
    ],
  },
  {
    id: 'sint_coordinador_pedidos_delivery',
    title: 'Coordinador(a) de pedidos de delivery',
    sector: 'Gastronomía y comercio electrónico',
    level: 'operativo',
    description:
      'Recibe pedidos de plataformas y canales propios, los registra, coordina su preparación con cocina o almacén y asigna repartidores, resolviendo incidencias con clientes.',
    tasks: [
      'Recibir y registrar pedidos',
      'Coordinar con cocina o almacén',
      'Asignar repartidores',
      'Resolver incidencias',
    ],
    responsibilities: ['Cumplir tiempos de entrega', 'Mantener informado al cliente'],
    competencies: [
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'formacion', text: 'Manejo de tabletas y plataformas de pedidos', mandatory: true },
    ],
  },
  {
    id: 'sint_digitador',
    title: 'Digitador(a) de datos',
    sector: 'Servicios empresariales',
    level: 'operativo',
    description:
      'Ingresa información de formularios, facturas o encuestas a sistemas o a hojas de cálculo con rapidez y exactitud. Revisa que los datos estén completos y corrige inconsistencias antes de cerrar cada lote.',
    tasks: [
      'Ingresar datos a sistemas u hojas de cálculo',
      'Verificar datos incompletos o inconsistentes',
      'Ordenar los documentos fuente',
      'Reportar el avance por lote',
    ],
    responsibilities: [
      'Mantener la exactitud de la información',
      'Proteger la confidencialidad de los datos',
    ],
    competencies: [
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'org_documentos', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Manejo de hojas de cálculo y digitación rápida',
        mandatory: true,
      },
      { kind: 'educacion', text: 'Secundaria completa', mandatory: false },
    ],
  },
  {
    id: 'sint_encargado_minimarket',
    title: 'Encargado(a) de bodega o minimarket',
    sector: 'Comercio minorista',
    level: 'supervision',
    description:
      'Gestiona la operación diaria de una bodega o minimarket: caja, compras a proveedores, control de stock, reposición y atención, y puede coordinar a uno o dos trabajadores.',
    tasks: [
      'Manejar la caja y cuadrarla',
      'Comprar a proveedores',
      'Controlar stock y vencimientos',
      'Coordinar al personal',
    ],
    responsibilities: ['Cuidar el dinero y la mercadería', 'Mantener la tienda abastecida'],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'reposicion', weight: 'complementaria' },
      { id: 'gestion_pedidos', weight: 'complementaria' },
      { id: 'coordinacion', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'experiencia', text: 'Experiencia en caja o en negocio propio', mandatory: true },
      { kind: 'experiencia', text: 'Experiencia coordinando personas', mandatory: false },
    ],
  },
  {
    id: 'sint_fumigacion',
    title: 'Operario(a) de desinfección y control de plagas',
    sector: 'Saneamiento ambiental',
    level: 'tecnico',
    description:
      'Aplica desinfectantes, insecticidas y raticidas en viviendas, comercios e industrias siguiendo fichas técnicas y normas sanitarias. Prepara mezclas con dosis exactas, usa equipo de protección y deja constancia del servicio.',
    tasks: [
      'Preparar mezclas según ficha técnica',
      'Aplicar productos con mochilas o nebulizadores',
      'Colocar y revisar cebaderos',
      'Llenar la constancia del servicio',
    ],
    responsibilities: [
      'Cuidar la salud de las personas del lugar',
      'Almacenar productos de forma segura',
    ],
    competencies: [
      { id: 'uso_productos', weight: 'clave' },
      { id: 'protocolos', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'control_suministros', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación certificada en manejo seguro de plaguicidas (según la empresa)',
        mandatory: true,
      },
      {
        kind: 'condicion',
        text: 'Uso permanente de equipo de protección respiratoria',
        mandatory: true,
      },
    ],
  },
  {
    id: 'sint_inventariador',
    title: 'Auxiliar de inventarios',
    sector: 'Comercio y logística',
    level: 'operativo',
    description:
      'Realiza conteos cíclicos y generales de mercadería, compara con el sistema, investiga diferencias y registra ajustes en tiendas o almacenes.',
    tasks: [
      'Contar productos por ubicación',
      'Comparar con el sistema',
      'Registrar diferencias',
      'Apoyar en inventarios generales',
    ],
    responsibilities: [
      'Garantizar la exactitud del inventario',
      'Reportar diferencias con sustento',
    ],
    competencies: [
      { id: 'control_existencias', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'org_productos', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'formacion', text: 'Excel básico', mandatory: true },
      { kind: 'condicion', text: 'Inventarios en horario nocturno', mandatory: false },
    ],
  },
  {
    id: 'sint_limpieza_hospitalaria',
    title: 'Personal de limpieza hospitalaria',
    sector: 'Salud',
    level: 'operativo',
    description:
      'Limpia y desinfecta habitaciones, salas y áreas críticas de un establecimiento de salud con protocolos estrictos de bioseguridad. Maneja residuos sólidos hospitalarios por tipo y registra la limpieza de cada ambiente.',
    tasks: [
      'Desinfectar áreas según su nivel de riesgo',
      'Segregar residuos biocontaminados y comunes',
      'Usar equipo de protección personal',
      'Registrar la limpieza realizada por ambiente',
    ],
    responsibilities: [
      'Evitar contaminación cruzada entre áreas',
      'Cumplir protocolos de bioseguridad',
    ],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'org_materiales', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en bioseguridad y manejo de residuos sólidos hospitalarios',
        mandatory: true,
      },
      {
        kind: 'experiencia',
        text: 'Experiencia previa en limpieza (de preferencia en salud)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_limpieza_oficinas',
    title: 'Operario(a) de limpieza de oficinas',
    sector: 'Servicios generales',
    level: 'operativo',
    description:
      'Mantiene limpias y ordenadas oficinas, baños y áreas comunes de una empresa, siguiendo un plan diario de limpieza y desinfección. Prepara los productos según la etiqueta, cuida los materiales y avisa a tiempo cuando faltan insumos.',
    tasks: [
      'Limpiar y desinfectar pisos, escritorios y baños',
      'Preparar y diluir productos de limpieza',
      'Vaciar papeleras y separar residuos',
      'Reportar insumos faltantes',
    ],
    responsibilities: [
      'Cumplir el plan de limpieza del turno',
      'Cuidar el uso seguro de productos y equipos',
    ],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'control_suministros', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'educacion', text: 'Primaria o secundaria (según el aviso)', mandatory: false },
      { kind: 'condicion', text: 'Disponibilidad para turnos rotativos', mandatory: false },
    ],
  },
  {
    id: 'sint_mercaderista',
    title: 'Mercaderista de consumo masivo',
    sector: 'Consumo masivo',
    level: 'operativo',
    description:
      'Visita supermercados y tiendas para reponer y ordenar los productos de una marca, asegurar su exhibición y precios, y reportar quiebres de stock con fotos desde el celular.',
    tasks: [
      'Reponer y ordenar productos de la marca',
      'Verificar precios y exhibición',
      'Reportar quiebres de stock',
      'Coordinar con encargados de tienda',
    ],
    responsibilities: ['Mantener la exhibición según el planograma', 'Reportar con evidencia'],
    competencies: [
      { id: 'reposicion', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'comunicacion', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'condicion', text: 'Desplazamiento entre tiendas en una ruta', mandatory: true },
      { kind: 'formacion', text: 'Uso de aplicaciones de reporte en celular', mandatory: false },
    ],
  },
  {
    id: 'sint_mesa_ayuda',
    title: 'Asistente de mesa de ayuda (soporte TI nivel 1)',
    sector: 'Tecnologías de la información',
    level: 'tecnico',
    description:
      'Registra incidencias de usuarios, resuelve problemas básicos de computadoras, correo o accesos con guías, y deriva al área técnica lo que no puede resolver.',
    tasks: [
      'Registrar incidencias en el sistema',
      'Resolver problemas básicos con guías',
      'Restablecer accesos y contraseñas',
      'Derivar casos complejos',
    ],
    responsibilities: [
      'Documentar cada incidencia',
      'Comunicar con claridad a usuarios no técnicos',
    ],
    competencies: [
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Estudios técnicos en computación o informática (en curso o concluidos)',
        mandatory: true,
      },
      {
        kind: 'formacion',
        text: 'Conocimientos básicos de sistemas operativos y redes',
        mandatory: true,
      },
    ],
  },
  {
    id: 'sint_mesa_partes',
    title: 'Auxiliar de mesa de partes',
    sector: 'Sector público',
    level: 'operativo',
    description:
      'Recibe, registra y deriva los documentos y expedientes que ingresan a una entidad, verificando que cumplan requisitos formales, y entrega cargos de recepción a los ciudadanos.',
    tasks: [
      'Recibir y revisar documentos',
      'Registrar expedientes en el sistema de trámite',
      'Derivar documentos a las áreas',
      'Entregar cargos y orientar al ciudadano',
    ],
    responsibilities: [
      'Garantizar el registro de cada documento',
      'Orientar correctamente al ciudadano',
    ],
    competencies: [
      { id: 'org_documentos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Secundaria completa o estudios técnicos (según la convocatoria)',
        mandatory: true,
      },
      {
        kind: 'condicion',
        text: 'Postulación por convocatoria pública (CAS u otra modalidad)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_montacarguista',
    title: 'Operador(a) de montacargas',
    sector: 'Logística',
    level: 'tecnico',
    description:
      'Opera montacargas para cargar, descargar, apilar y trasladar mercadería paletizada en almacenes, cumpliendo normas de seguridad y procedimientos de inspección del equipo.',
    tasks: [
      'Operar montacargas',
      'Cargar y descargar camiones',
      'Ubicar pallets en racks',
      'Inspeccionar el equipo antes de usarlo',
    ],
    responsibilities: ['Operar con seguridad', 'Cuidar la mercadería y el equipo'],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'recepcion_mercaderia', weight: 'clave' },
      { id: 'org_productos', weight: 'complementaria' },
      { id: 'control_existencias', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'certificacion',
        text: 'Certificado de operador de montacargas vigente',
        mandatory: true,
      },
      {
        kind: 'experiencia',
        text: 'Experiencia operando montacargas (frecuente en avisos)',
        mandatory: true,
      },
      { kind: 'licencia', text: 'Algunas empresas piden licencia de conducir', mandatory: false },
    ],
  },
  {
    id: 'sint_mostrador_ferreteria',
    title: 'Vendedor(a) de mostrador en ferretería',
    sector: 'Comercio de materiales de construcción',
    level: 'operativo',
    description:
      'Atiende a clientes en mostrador, identifica el producto que necesitan (a veces con descripciones técnicas), cotiza, vende y coordina el despacho.',
    tasks: [
      'Atender en mostrador',
      'Identificar el producto que necesita el cliente',
      'Cotizar y vender',
      'Coordinar el despacho',
    ],
    responsibilities: ['Recomendar el producto correcto', 'Mantener precios actualizados'],
    competencies: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'ventas', weight: 'clave' },
      { id: 'org_productos', weight: 'complementaria' },
      { id: 'gestion_pedidos', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Conocimiento de productos de ferretería (se aprende en el puesto)',
        mandatory: true,
      },
      { kind: 'experiencia', text: 'Experiencia en ventas', mandatory: false },
    ],
  },
  {
    id: 'sint_mozo',
    title: 'Mozo(a) de restaurante',
    sector: 'Gastronomía',
    level: 'operativo',
    description:
      'Recibe a los comensales, toma pedidos, recomienda platos, coordina con cocina, sirve y cobra la cuenta cuidando una atención amable y rápida.',
    tasks: [
      'Tomar pedidos',
      'Recomendar platos y bebidas',
      'Coordinar con cocina',
      'Servir y presentar la cuenta',
    ],
    responsibilities: ['Atender con rapidez y amabilidad', 'Evitar errores en los pedidos'],
    competencies: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'manejo_dinero', weight: 'complementaria' },
      { id: 'ventas', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en atención en restaurantes (deseable)',
        mandatory: false,
      },
      { kind: 'condicion', text: 'Turnos de noche y fines de semana', mandatory: false },
    ],
  },
  {
    id: 'sint_picking_packing',
    title: 'Operario(a) de picking y packing en centro de distribución',
    sector: 'Comercio electrónico y logística',
    level: 'operativo',
    description:
      'Selecciona productos de las ubicaciones del almacén con lectores o listas, los empaca para el envío y cumple metas de productividad en centros de distribución de comercio electrónico.',
    tasks: [
      'Recoger productos por ubicación',
      'Escanear con lector de códigos',
      'Empacar y rotular pedidos',
      'Reportar diferencias de stock',
    ],
    responsibilities: ['Cumplir metas de productividad', 'Evitar errores de pedido'],
    competencies: [
      { id: 'org_productos', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'protocolos', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Uso de lectores de códigos (inducción de la empresa)',
        mandatory: false,
      },
      { kind: 'condicion', text: 'Turnos rotativos y trabajo de pie', mandatory: false },
    ],
  },
  {
    id: 'sint_playero_grifo',
    title: 'Despachador(a) de combustible (playero)',
    sector: 'Combustibles',
    level: 'operativo',
    description:
      'Despacha combustible a vehículos, cobra con distintos medios, entrega comprobante y cumple estrictas normas de seguridad de la estación.',
    tasks: [
      'Despachar combustible',
      'Cobrar y entregar comprobante',
      'Cumplir normas de seguridad',
      'Cuadrar al fin del turno',
    ],
    responsibilities: ['Evitar riesgos de incendio o derrames', 'Cuadrar sin diferencias'],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'medios_pago', weight: 'clave' },
      { id: 'protocolos', weight: 'clave' },
      { id: 'calculo_vuelto', weight: 'complementaria' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en seguridad en estaciones de servicio (la brinda la empresa)',
        mandatory: true,
      },
      { kind: 'condicion', text: 'Turnos nocturnos', mandatory: false },
    ],
  },
  {
    id: 'sint_produccion_alimentos',
    title: 'Operario(a) de producción en planta de alimentos',
    sector: 'Industria alimentaria',
    level: 'operativo',
    description:
      'Participa en la elaboración, envasado o etiquetado de alimentos en una línea de producción, cumpliendo buenas prácticas de manufactura y de higiene personal. Limpia su estación al cambiar de lote.',
    tasks: [
      'Alimentar y vigilar la línea de producción',
      'Envasar y etiquetar productos',
      'Limpiar y desinfectar la estación',
      'Registrar lotes producidos',
    ],
    responsibilities: ['Cumplir buenas prácticas de manufactura', 'Reportar productos defectuosos'],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'uso_productos', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'org_productos', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'formacion',
        text: 'Capacitación en buenas prácticas de manufactura (BPM)',
        mandatory: true,
      },
      { kind: 'educacion', text: 'Secundaria completa (frecuente en plantas)', mandatory: false },
    ],
  },
  {
    id: 'sint_promotor_ventas',
    title: 'Promotor(a) de ventas',
    sector: 'Consumo masivo',
    level: 'operativo',
    description:
      'Promociona productos de una marca en supermercados o ferias, ofrece degustaciones o muestras, explica beneficios al cliente y busca cerrar ventas para cumplir metas diarias.',
    tasks: [
      'Abordar y orientar clientes',
      'Explicar beneficios del producto',
      'Ordenar el punto de venta',
      'Reportar ventas del día',
    ],
    responsibilities: ['Cumplir metas de venta', 'Representar bien a la marca'],
    competencies: [
      { id: 'ventas', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'org_productos', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'condicion', text: 'Disponibilidad fines de semana', mandatory: false },
      { kind: 'condicion', text: 'Pago con comisiones según metas', mandatory: false },
    ],
  },
  {
    id: 'sint_recepcionista',
    title: 'Recepcionista de oficina',
    sector: 'Servicios empresariales',
    level: 'operativo',
    description:
      'Recibe y orienta a visitantes, atiende llamadas y correos, registra el ingreso de personas y deriva consultas a las áreas correspondientes. Es la primera imagen de la organización.',
    tasks: [
      'Recibir y registrar visitantes',
      'Atender llamadas y derivarlas',
      'Gestionar correspondencia',
      'Agendar reuniones y salas',
    ],
    responsibilities: ['Brindar una atención cordial', 'Mantener el registro de visitas'],
    competencies: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'coordinacion', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'educacion', text: 'Secundaria completa', mandatory: true },
      { kind: 'formacion', text: 'Manejo de correo y ofimática básica', mandatory: false },
    ],
  },
  {
    id: 'sint_reciclaje',
    title: 'Operario(a) de segregación y reciclaje de residuos',
    sector: 'Gestión ambiental',
    level: 'operativo',
    description:
      'Clasifica residuos reciclables por tipo (papel, plástico, vidrio, metal) en plantas o centros de acopio, los prensa y los almacena para su venta. Registra cantidades y cuida su seguridad al manipular residuos.',
    tasks: [
      'Clasificar residuos por material',
      'Compactar y embalar material reciclable',
      'Pesar y registrar lotes',
      'Mantener ordenada el área de acopio',
    ],
    responsibilities: ['Separar correctamente los materiales', 'Trabajar con equipo de protección'],
    competencies: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'control_existencias', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'formacion', text: 'Inducción en manejo seguro de residuos', mandatory: true },
      { kind: 'condicion', text: 'Trabajo físico de pie', mandatory: false },
    ],
  },
  {
    id: 'sint_repartidor_contraentrega',
    title: 'Repartidor(a) motorizado con cobro contraentrega',
    sector: 'Distribución y comercio electrónico',
    level: 'operativo',
    description:
      'Entrega pedidos en moto, cobra en efectivo o con billeteras al momento de la entrega, registra cada entrega en una aplicación y rinde cuentas del dinero al final del día.',
    tasks: [
      'Entregar pedidos en ruta',
      'Cobrar contraentrega',
      'Registrar entregas en la aplicación',
      'Rendir el dinero del día',
    ],
    responsibilities: ['Cuidar el dinero y la mercadería', 'Cumplir rutas y horarios'],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'medios_pago', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'calculo_vuelto', weight: 'complementaria' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'licencia', text: 'Licencia de conducir para motocicleta vigente', mandatory: true },
      { kind: 'condicion', text: 'SOAT vigente y, en algunos casos, moto propia', mandatory: true },
    ],
  },
  {
    id: 'sint_supervisor_cajas',
    title: 'Supervisor(a) de cajas',
    sector: 'Retail',
    level: 'supervision',
    description:
      'Supervisa a los cajeros de una tienda: autoriza anulaciones, hace arqueos sorpresa, atiende incidencias de pago y consolida el cierre de cajas del día.',
    tasks: [
      'Autorizar anulaciones',
      'Hacer arqueos',
      'Resolver incidencias de pago',
      'Consolidar el cierre',
    ],
    responsibilities: ['Asegurar que las cajas cuadren', 'Liderar al equipo de cajeros'],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'medios_pago', weight: 'complementaria' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'experiencia', text: 'Dos años o más como cajero(a)', mandatory: true },
      { kind: 'experiencia', text: 'Experiencia liderando personas', mandatory: false },
    ],
  },
  {
    id: 'sint_supervisor_limpieza',
    title: 'Supervisor(a) de cuadrilla de limpieza',
    sector: 'Servicios generales',
    level: 'supervision',
    description:
      'Organiza y supervisa a un equipo de limpieza en una o varias sedes: asigna tareas, verifica la calidad del trabajo, controla asistencia e insumos y coordina con el cliente.',
    tasks: [
      'Asignar tareas y turnos al equipo',
      'Inspeccionar la calidad de la limpieza',
      'Controlar consumo de insumos',
      'Coordinar con el responsable del cliente',
    ],
    responsibilities: ['Cumplir el contrato de servicio', 'Velar por la seguridad del equipo'],
    competencies: [
      { id: 'coordinacion', weight: 'clave' },
      { id: 'protocolos', weight: 'clave' },
      { id: 'control_suministros', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
      { id: 'org_materiales', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'experiencia', text: 'Dos años o más de experiencia en limpieza', mandatory: true },
      { kind: 'experiencia', text: 'Experiencia previa coordinando personas', mandatory: false },
      { kind: 'formacion', text: 'Manejo básico de reportes digitales', mandatory: false },
    ],
  },
  {
    id: 'sint_supervisor_tienda',
    title: 'Supervisor(a) de tienda',
    sector: 'Retail',
    level: 'supervision',
    description:
      'Organiza el trabajo del personal de una tienda, controla ventas, inventario y caja, atiende casos difíciles con clientes y reporta resultados a la jefatura.',
    tasks: [
      'Organizar turnos y tareas',
      'Controlar ventas y caja',
      'Revisar inventario',
      'Atender casos difíciles',
    ],
    responsibilities: ['Cumplir metas de la tienda', 'Liderar al equipo'],
    competencies: [
      { id: 'coordinacion', weight: 'clave' },
      { id: 'ventas', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'control_existencias', weight: 'complementaria' },
      { id: 'manejo_dinero', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'experiencia', text: 'Dos años o más en ventas en tienda', mandatory: true },
      { kind: 'experiencia', text: 'Experiencia liderando personas', mandatory: false },
      { kind: 'formacion', text: 'Excel básico', mandatory: true },
    ],
  },
  {
    id: 'sint_venta_seguros',
    title: 'Asesor(a) de ventas de seguros',
    sector: 'Seguros',
    level: 'tecnico',
    description:
      'Ofrece seguros personales o vehiculares a clientes, explica coberturas y exclusiones, registra solicitudes y acompaña el proceso de emisión de pólizas.',
    tasks: [
      'Identificar necesidades del cliente',
      'Explicar coberturas y exclusiones',
      'Registrar solicitudes',
      'Hacer seguimiento a la emisión',
    ],
    responsibilities: ['Informar con transparencia', 'Cumplir normas del sector'],
    competencies: [
      { id: 'ventas', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'certificacion',
        text: 'Acreditación o registro exigido por el sector asegurador, según el tipo de canal',
        mandatory: true,
      },
      {
        kind: 'educacion',
        text: 'Estudios técnicos o universitarios (frecuentes)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_ventanilla_banco',
    title: 'Promotor(a) de servicios / cajero(a) de agencia bancaria',
    sector: 'Servicios financieros',
    level: 'tecnico',
    description:
      'Atiende operaciones en ventanilla (depósitos, retiros, pagos), verifica billetes y firmas, registra cada operación en el sistema y cuadra la bóveda asignada.',
    tasks: [
      'Realizar depósitos y retiros',
      'Verificar billetes y documentos',
      'Registrar operaciones',
      'Cuadrar al cierre',
    ],
    responsibilities: [
      'Cumplir normas de seguridad y prevención de lavado de activos',
      'Cuadrar sin diferencias',
    ],
    competencies: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'protocolos', weight: 'complementaria' },
    ],
    requirements: [
      {
        kind: 'educacion',
        text: 'Estudios técnicos o universitarios en curso (frecuente en bancos)',
        mandatory: true,
      },
      { kind: 'condicion', text: 'Verificación de antecedentes', mandatory: true },
      {
        kind: 'formacion',
        text: 'Capacitación en prevención de lavado de activos (la brinda la entidad)',
        mandatory: true,
      },
    ],
  },
  {
    id: 'sint_ventas_telefonia',
    title: 'Asesor(a) de ventas de telefonía y tecnología',
    sector: 'Telecomunicaciones',
    level: 'operativo',
    description:
      'Asesora a clientes en tienda sobre planes móviles y equipos, registra las ventas y activaciones en el sistema y explica condiciones de contrato con claridad.',
    tasks: [
      'Asesorar sobre planes y equipos',
      'Registrar ventas y activaciones',
      'Explicar condiciones del contrato',
      'Cumplir metas mensuales',
    ],
    responsibilities: ['Informar con transparencia', 'Registrar correctamente cada venta'],
    competencies: [
      { id: 'ventas', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'educacion', text: 'Secundaria completa', mandatory: true },
      {
        kind: 'formacion',
        text: 'Conocimiento de productos tecnológicos (capacitación de la empresa)',
        mandatory: false,
      },
    ],
  },
  {
    id: 'sint_ventas_whatsapp',
    title: 'Asesor(a) de ventas digitales (WhatsApp y redes)',
    sector: 'Comercio electrónico',
    level: 'operativo',
    description:
      'Atiende consultas y cierra ventas por WhatsApp, Instagram o Facebook, registra pedidos, coordina pagos y entregas y hace seguimiento a clientes.',
    tasks: [
      'Responder consultas y cerrar ventas',
      'Registrar pedidos',
      'Coordinar pagos y entregas',
      'Hacer seguimiento posventa',
    ],
    responsibilities: ['Responder rápido y con claridad', 'Registrar cada pedido'],
    competencies: [
      { id: 'ventas', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
      { id: 'medios_pago', weight: 'complementaria' },
    ],
    requirements: [
      { kind: 'formacion', text: 'Manejo de WhatsApp Business y redes sociales', mandatory: true },
    ],
  },
];
