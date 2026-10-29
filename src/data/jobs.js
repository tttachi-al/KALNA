/**
 * Catálogo de PUESTOS para recomendar postulaciones (más allá de las cinco ocupaciones).
 *
 * KALLPA no muestra vacantes inventadas: recomienda puestos según las competencias
 * del perfil y envía a Empleos Perú (MTPE), donde están las ofertas vigentes.
 *
 * Los requisitos (`requires`) son competencias de referencia (datos de demostración),
 * con el mismo formato que las ocupaciones. En producción deberían venir de perfiles
 * ocupacionales validados o de la clasificación de ocupaciones del MTPE.
 *
 *  - search: término sugerido para buscar el puesto en Empleos Perú.
 *  - area:   rubro, para orientar a la persona.
 */

export const JOBS = [
  {
    id: 'aux_almacen',
    name: 'Auxiliar de almacén',
    area: 'Logística',
    search: 'Auxiliar de almacén',
    summary: 'Recibe, ordena y despacha mercadería; lleva el control de entradas y salidas.',
    requires: [
      { id: 'recepcion_mercaderia', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
  },
  {
    id: 'aux_despacho',
    name: 'Auxiliar de despacho',
    area: 'Logística',
    search: 'Auxiliar de despacho',
    summary: 'Prepara pedidos, verifica que estén completos y coordina su entrega.',
    requires: [
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
  },
  {
    id: 'aux_compras',
    name: 'Auxiliar de compras y abastecimiento',
    area: 'Logística',
    search: 'Auxiliar de compras',
    summary: 'Revisa qué insumos faltan, registra los pedidos y hace seguimiento a su llegada.',
    requires: [
      { id: 'control_suministros', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
  },
  {
    id: 'operario_mantenimiento',
    name: 'Operario de limpieza y mantenimiento',
    area: 'Servicios generales',
    search: 'Operario de limpieza',
    summary: 'Mantiene instalaciones limpias y operativas en empresas, centros comerciales o industrias.',
    requires: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'control_suministros', weight: 'complementaria' },
    ],
  },
  {
    id: 'limpieza_salud',
    name: 'Personal de limpieza en centros de salud',
    area: 'Salud',
    search: 'Limpieza hospitalaria',
    summary: 'Limpia y desinfecta ambientes de clínicas u hospitales con protocolos estrictos.',
    requires: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'org_materiales', weight: 'complementaria' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
  },
  {
    id: 'ayudante_cocina',
    name: 'Ayudante de cocina',
    area: 'Alimentos',
    search: 'Ayudante de cocina',
    summary: 'Apoya en la preparación de alimentos, la limpieza y el orden de los insumos.',
    requires: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'control_suministros', weight: 'complementaria' },
      { id: 'coordinacion', weight: 'complementaria' },
    ],
  },
  {
    id: 'operario_produccion',
    name: 'Operario de producción y empaque',
    area: 'Industria',
    search: 'Operario de producción',
    summary: 'Trabaja en líneas de producción o empaque siguiendo normas de calidad y seguridad.',
    requires: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'coordinacion', weight: 'clave' },
      { id: 'control_existencias', weight: 'complementaria' },
    ],
  },
  {
    id: 'recepcionista',
    name: 'Recepcionista',
    area: 'Atención al público',
    search: 'Recepcionista',
    summary: 'Recibe y orienta a las personas, atiende llamadas y registra visitas o citas.',
    requires: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'complementaria' },
    ],
  },
  {
    id: 'asesor_telefonico',
    name: 'Asesor(a) de atención telefónica',
    area: 'Atención al público',
    search: 'Asesor call center',
    summary: 'Atiende consultas por teléfono o chat y registra cada caso en el sistema.',
    requires: [
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
  },
  {
    id: 'promotor_ventas',
    name: 'Promotor(a) de ventas',
    area: 'Comercio',
    search: 'Promotor de ventas',
    summary: 'Presenta productos en tiendas o ferias, orienta a los clientes y promueve la venta.',
    requires: [
      { id: 'ventas', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'org_productos', weight: 'complementaria' },
    ],
  },
  {
    id: 'mozo',
    name: 'Mozo(a) o azafata de restaurante',
    area: 'Alimentos',
    search: 'Mozo',
    summary: 'Atiende mesas, toma pedidos y coordina con cocina y caja.',
    requires: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'comunicacion', weight: 'complementaria' },
      { id: 'manejo_dinero', weight: 'complementaria' },
    ],
  },
  {
    id: 'digitador',
    name: 'Digitador(a) o asistente de registro',
    area: 'Administración',
    search: 'Digitador',
    summary: 'Ingresa y ordena información en sistemas o archivos, cuidando que no haya errores.',
    requires: [
      { id: 'registro_info', weight: 'clave' },
      { id: 'herramientas_digitales', weight: 'clave' },
      { id: 'org_documentos', weight: 'clave' },
    ],
  },
  {
    id: 'aux_cobranzas',
    name: 'Auxiliar de cobranzas',
    area: 'Administración',
    search: 'Auxiliar de cobranzas',
    summary: 'Registra pagos, emite comprobantes y hace seguimiento a cuentas por cobrar.',
    requires: [
      { id: 'manejo_dinero', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'clave' },
      { id: 'medios_pago', weight: 'clave' },
      { id: 'comunicacion', weight: 'complementaria' },
    ],
  },
  {
    id: 'camarero_hotel',
    name: 'Camarero(a) de pisos en hotel',
    area: 'Turismo y hotelería',
    search: 'Camarera de pisos',
    summary: 'Limpia y ordena habitaciones y áreas comunes, y repone los insumos para los huéspedes.',
    requires: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'uso_productos', weight: 'clave' },
      { id: 'control_suministros', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
  },
  {
    id: 'operario_lavanderia',
    name: 'Operario(a) de lavandería',
    area: 'Servicios generales',
    search: 'Operario de lavandería',
    summary: 'Clasifica, lava y entrega prendas o ropa de cama usando productos y equipos con cuidado.',
    requires: [
      { id: 'uso_productos', weight: 'clave' },
      { id: 'org_materiales', weight: 'clave' },
      { id: 'protocolos', weight: 'complementaria' },
      { id: 'registro_info', weight: 'complementaria' },
    ],
  },
  {
    id: 'aux_farmacia',
    name: 'Auxiliar de farmacia o botica',
    area: 'Salud',
    search: 'Auxiliar de farmacia',
    summary: 'Atiende al público, ordena los productos por lote y vencimiento, y registra las ventas.',
    requires: [
      { id: 'atencion_cliente', weight: 'clave' },
      { id: 'control_existencias', weight: 'clave' },
      { id: 'org_productos', weight: 'clave' },
      { id: 'registro_transacciones', weight: 'complementaria' },
    ],
  },
  {
    id: 'repartidor',
    name: 'Repartidor(a)',
    area: 'Logística',
    search: 'Repartidor',
    summary: 'Entrega pedidos a domicilio, confirma con el cliente y recibe pagos cuando corresponde.',
    requires: [
      { id: 'gestion_pedidos', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'manejo_dinero', weight: 'complementaria' },
      { id: 'medios_pago', weight: 'complementaria' },
    ],
  },
  {
    id: 'conserje',
    name: 'Conserje o personal de portería',
    area: 'Servicios generales',
    search: 'Conserje',
    summary: 'Controla el ingreso de personas, registra visitas y vela por el orden del edificio.',
    requires: [
      { id: 'protocolos', weight: 'clave' },
      { id: 'registro_info', weight: 'clave' },
      { id: 'comunicacion', weight: 'clave' },
      { id: 'atencion_cliente', weight: 'complementaria' },
    ],
  },
];
