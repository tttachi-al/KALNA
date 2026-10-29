# Catálogo sintético: selección de 50 empleos (sintetico-v2)

Selección hecha el 2026-10-28 a partir de los 100 empleos de `sintetico-v1`. No es el orden por identificador.

## Criterios
1. **Variedad de tareas:** se retiraron variantes casi iguales (por ejemplo, varias cajas de distintos comercios, varias limpiezas de recinto) y se conservó una representativa.
2. **Cobertura de competencias:** las 20 competencias del catálogo aparecen; cada una es **clave** en al menos 2 empleos.
3. **Transferencia de habilidades:** se conservan puestos que combinan competencias de familias distintas (por ejemplo, admisión en clínica, ventas por WhatsApp, almacén, mesa de ayuda) y puestos de nivel técnico y de supervisión.
4. **Realismo y barreras:** se conservan puestos con requisitos verificables (montacargas, banca, seguros, inmobiliario, farmacia) para probar los «requisitos por verificar».

## Métricas comprobadas (en código antes de borrar)
- Empleos: 50 · sectores distintos: 30 · niveles: operativo 36, tecnico 9, supervision 5
- Competencias cubiertas: 20 de 20
- Veces que cada competencia es clave: org_materiales 5 · uso_productos 4 · protocolos 12 · control_suministros 3 · org_documentos 4 · registro_info 10 · herramientas_digitales 6 · coordinacion 7 · org_productos 6 · control_existencias 8 · reposicion 2 · recepcion_mercaderia 4 · atencion_cliente 15 · comunicacion 12 · ventas 7 · gestion_pedidos 7 · manejo_dinero 10 · calculo_vuelto 2 · medios_pago 4 · registro_transacciones 6
- Sin pares con funciones ≥ 60 % iguales (`validateCatalog`).

## Se conservan (50)
| id | Empleo | Sector | Nivel | Competencias clave |
|---|---|---|---|---|
| `sint_abastecedor_grifo_tienda` | Abastecedor(a) de tienda de conveniencia | Retail | operativo | reposicion, recepcion_mercaderia, control_existencias |
| `sint_admision_clinica` | Asistente de admisión en clínica | Salud | operativo | atencion_cliente, registro_info |
| `sint_agente_corresponsal` | Operador(a) de agente corresponsal bancario | Servicios financieros | operativo | manejo_dinero, medios_pago, registro_transacciones |
| `sint_agente_inmobiliario` | Asesor(a) inmobiliario junior | Inmobiliario | tecnico | ventas, comunicacion |
| `sint_archivo` | Asistente de archivo y gestión documental | Servicios empresariales | operativo | org_documentos, registro_info |
| `sint_asistente_compras` | Asistente de compras | Comercio y servicios | operativo | gestion_pedidos, registro_info, coordinacion |
| `sint_asistente_rrhh` | Asistente de recursos humanos | Servicios empresariales | tecnico | org_documentos, registro_info, coordinacion |
| `sint_asistente_supervisor_almacen` | Asistente de supervisión de almacén | Logística | supervision | coordinacion, control_existencias, recepcion_mercaderia |
| `sint_atencion_redes` | Asesor(a) de atención por chat y redes sociales | Comercio electrónico | operativo | herramientas_digitales, comunicacion, atencion_cliente |
| `sint_auxiliar_almacen` | Auxiliar de almacén | Logística | operativo | recepcion_mercaderia, control_existencias, org_productos |
| `sint_auxiliar_cobranzas` | Auxiliar de cobranzas | Servicios empresariales | operativo | registro_transacciones, manejo_dinero, comunicacion |
| `sint_auxiliar_contable` | Auxiliar contable | Servicios contables | tecnico | registro_info, org_documentos, herramientas_digitales |
| `sint_auxiliar_despacho` | Auxiliar de despacho | Logística | operativo | gestion_pedidos, org_productos |
| `sint_auxiliar_farmacia` | Auxiliar de farmacia o botica | Salud y retail farmacéutico | operativo | atencion_cliente, org_productos |
| `sint_auxiliar_tesoreria` | Auxiliar de tesorería | Servicios empresariales | tecnico | registro_transacciones, manejo_dinero, herramientas_digitales |
| `sint_ayudante_cocina` | Ayudante de cocina | Gastronomía | operativo | protocolos, org_materiales, control_suministros |
| `sint_ayudante_mantenimiento` | Ayudante de mantenimiento general | Servicios generales | operativo | org_materiales, protocolos |
| `sint_barista` | Barista | Gastronomía | operativo | atencion_cliente, gestion_pedidos |
| `sint_cajero_supermercado` | Cajero(a) de supermercado | Retail | operativo | manejo_dinero, calculo_vuelto, medios_pago, atencion_cliente |
| `sint_call_center` | Asesor(a) de atención telefónica | Telecomunicaciones y servicios | operativo | comunicacion, atencion_cliente, herramientas_digitales |
| `sint_camara_frio` | Operario(a) de cámara de frío | Logística de alimentos | operativo | control_existencias, protocolos, org_productos |
| `sint_camarera_pisos` | Camarero(a) de pisos en hotel | Hotelería y turismo | operativo | protocolos, uso_productos, control_suministros |
| `sint_casa_cambio` | Cajero(a) de casa de cambio | Servicios financieros | operativo | manejo_dinero, calculo_vuelto, registro_transacciones |
| `sint_coordinador_pedidos_delivery` | Coordinador(a) de pedidos de delivery | Gastronomía y comercio electrónico | operativo | gestion_pedidos, coordinacion, comunicacion |
| `sint_digitador` | Digitador(a) de datos | Servicios empresariales | operativo | registro_info, herramientas_digitales |
| `sint_encargado_minimarket` | Encargado(a) de bodega o minimarket | Comercio minorista | supervision | manejo_dinero, control_existencias, atencion_cliente |
| `sint_fumigacion` | Operario(a) de desinfección y control de plagas | Saneamiento ambiental | tecnico | uso_productos, protocolos |
| `sint_inventariador` | Auxiliar de inventarios | Comercio y logística | operativo | control_existencias, registro_info |
| `sint_limpieza_hospitalaria` | Personal de limpieza hospitalaria | Salud | operativo | protocolos, uso_productos |
| `sint_limpieza_oficinas` | Operario(a) de limpieza de oficinas | Servicios generales | operativo | protocolos, uso_productos, org_materiales |
| `sint_mercaderista` | Mercaderista de consumo masivo | Consumo masivo | operativo | reposicion, org_productos, control_existencias |
| `sint_mesa_ayuda` | Asistente de mesa de ayuda (soporte TI nivel 1) | Tecnologías de la información | tecnico | herramientas_digitales, registro_info, comunicacion |
| `sint_mesa_partes` | Auxiliar de mesa de partes | Sector público | operativo | org_documentos, registro_info, atencion_cliente |
| `sint_montacarguista` | Operador(a) de montacargas | Logística | tecnico | protocolos, recepcion_mercaderia |
| `sint_mostrador_ferreteria` | Vendedor(a) de mostrador en ferretería | Comercio de materiales de construcción | operativo | atencion_cliente, ventas |
| `sint_mozo` | Mozo(a) de restaurante | Gastronomía | operativo | atencion_cliente, gestion_pedidos, comunicacion |
| `sint_picking_packing` | Operario(a) de picking y packing en centro de distribución | Comercio electrónico y logística | operativo | org_productos, control_existencias |
| `sint_playero_grifo` | Despachador(a) de combustible (playero) | Combustibles | operativo | manejo_dinero, medios_pago, protocolos |
| `sint_produccion_alimentos` | Operario(a) de producción en planta de alimentos | Industria alimentaria | operativo | protocolos, org_materiales |
| `sint_promotor_ventas` | Promotor(a) de ventas | Consumo masivo | operativo | ventas, comunicacion, atencion_cliente |
| `sint_recepcionista` | Recepcionista de oficina | Servicios empresariales | operativo | atencion_cliente, comunicacion, registro_info |
| `sint_reciclaje` | Operario(a) de segregación y reciclaje de residuos | Gestión ambiental | operativo | protocolos, org_materiales |
| `sint_repartidor_contraentrega` | Repartidor(a) motorizado con cobro contraentrega | Distribución y comercio electrónico | operativo | manejo_dinero, medios_pago, gestion_pedidos |
| `sint_supervisor_cajas` | Supervisor(a) de cajas | Retail | supervision | manejo_dinero, registro_transacciones, coordinacion |
| `sint_supervisor_limpieza` | Supervisor(a) de cuadrilla de limpieza | Servicios generales | supervision | coordinacion, protocolos, control_suministros |
| `sint_supervisor_tienda` | Supervisor(a) de tienda | Retail | supervision | coordinacion, ventas, atencion_cliente |
| `sint_venta_seguros` | Asesor(a) de ventas de seguros | Seguros | tecnico | ventas, comunicacion |
| `sint_ventanilla_banco` | Promotor(a) de servicios / cajero(a) de agencia bancaria | Servicios financieros | tecnico | manejo_dinero, registro_transacciones, atencion_cliente |
| `sint_ventas_telefonia` | Asesor(a) de ventas de telefonía y tecnología | Telecomunicaciones | operativo | ventas, atencion_cliente, comunicacion |
| `sint_ventas_whatsapp` | Asesor(a) de ventas digitales (WhatsApp y redes) | Comercio electrónico | operativo | ventas, gestion_pedidos, comunicacion |

## Se retiran (50)
| id | Empleo | Sector | Nivel | Competencias clave |
|---|---|---|---|---|
| `sint_abastecimiento_hospital` | Auxiliar de abastecimiento en establecimiento de salud | Salud | operativo | control_suministros, control_existencias, gestion_pedidos |
| `sint_administrativo_obra` | Asistente administrativo de obra | Construcción | operativo | org_documentos, registro_info, coordinacion |
| `sint_agendamiento` | Coordinador(a) de citas y agendamiento | Servicios | operativo | coordinacion, herramientas_digitales, registro_info |
| `sint_almacen_insumos_limpieza` | Auxiliar de almacén de insumos de limpieza | Servicios generales | operativo | control_suministros, org_materiales, recepcion_mercaderia |
| `sint_almacenero_obra` | Almacenero(a) de obra | Construcción | operativo | control_existencias, recepcion_mercaderia, registro_info |
| `sint_anfitrion_eventos` | Anfitrión(a) de eventos y ferias | Eventos | operativo | comunicacion, atencion_cliente |
| `sint_areas_verdes` | Operario(a) de mantenimiento de áreas verdes | Servicios generales | operativo | org_materiales, protocolos |
| `sint_asesor_campo` | Asesor(a) comercial de campo | Servicios financieros y comercio | operativo | ventas, comunicacion |
| `sint_auxiliar_biblioteca` | Auxiliar de biblioteca | Educación y cultura | operativo | org_documentos, registro_info |
| `sint_ayudante_ferreteria_almacen` | Despachador(a) de almacén de ferretería y materiales | Comercio de materiales de construcción | operativo | org_productos, control_existencias |
| `sint_ayudante_reparto` | Ayudante de reparto | Distribución | operativo | recepcion_mercaderia, org_productos |
| `sint_back_office_comercial` | Asistente de back office comercial | Comercio | operativo | gestion_pedidos, registro_info, herramientas_digitales |
| `sint_bodega_restaurante` | Encargado(a) de bodega de restaurante | Gastronomía | operativo | recepcion_mercaderia, control_existencias, control_suministros |
| `sint_boletero` | Boletero(a) de cine o terminal terrestre | Entretenimiento y transporte | operativo | manejo_dinero, medios_pago, atencion_cliente |
| `sint_caja_casino` | Cajero(a) de sala de juegos | Entretenimiento | operativo | manejo_dinero, calculo_vuelto, registro_transacciones |
| `sint_caja_chica` | Asistente de caja chica y rendiciones | Servicios empresariales | operativo | manejo_dinero, registro_transacciones |
| `sint_caja_comida_rapida` | Cajero(a) de restaurante de comida rápida | Gastronomía | operativo | manejo_dinero, medios_pago, atencion_cliente |
| `sint_caja_tienda_departamentos` | Cajero(a) de tienda por departamentos | Retail | operativo | manejo_dinero, medios_pago, atencion_cliente |
| `sint_clasificacion_courier` | Operario(a) de clasificación en courier | Mensajería y paquetería | operativo | org_productos, recepcion_mercaderia |
| `sint_conserje_escolar` | Auxiliar de limpieza y mantenimiento escolar | Educación | operativo | protocolos, org_materiales, control_suministros |
| `sint_control_calidad_recepcion` | Auxiliar de control de calidad en recepción de alimentos | Industria alimentaria | tecnico | recepcion_mercaderia, protocolos, registro_info |
| `sint_control_documentario_logistica` | Auxiliar de control documentario logístico | Logística | operativo | org_documentos, registro_info |
| `sint_counter_viajes` | Counter de agencia de viajes | Turismo | tecnico | atencion_cliente, ventas, comunicacion |
| `sint_cuentas_por_cobrar` | Asistente de cuentas por cobrar | Servicios empresariales | tecnico | registro_transacciones, herramientas_digitales |
| `sint_encuestador` | Encuestador(a) de campo | Investigación y estadística | operativo | registro_info, comunicacion, herramientas_digitales |
| `sint_esterilizacion` | Auxiliar de central de esterilización | Salud | tecnico | protocolos, org_materiales, registro_info |
| `sint_estibador` | Operario(a) de carga y descarga | Transporte y logística | operativo | protocolos, recepcion_mercaderia |
| `sint_facturacion` | Asistente de facturación | Comercio y servicios | operativo | registro_transacciones, herramientas_digitales, registro_info |
| `sint_lavado_vehiculos` | Operario(a) de lavado y detallado de vehículos | Servicios automotrices | operativo | uso_productos, org_materiales |
| `sint_lavanderia_industrial` | Operario(a) de lavandería industrial | Servicios | operativo | uso_productos, protocolos, org_materiales |
| `sint_limpieza_industrial` | Operario(a) de limpieza industrial en planta | Manufactura | operativo | protocolos, uso_productos |
| `sint_limpieza_terminal` | Personal de limpieza en aeropuerto o terminal de transporte | Transporte | operativo | protocolos, uso_productos, org_materiales |
| `sint_logistica_inversa` | Operario(a) de devoluciones y logística inversa | Comercio y logística | operativo | recepcion_mercaderia, org_productos |
| `sint_mantenimiento_piscinas` | Operario(a) de mantenimiento de piscinas | Servicios recreativos | tecnico | uso_productos, protocolos |
| `sint_panaderia` | Vendedor(a) de panadería y pastelería | Gastronomía y comercio | operativo | atencion_cliente, gestion_pedidos, ventas |
| `sint_peaje` | Recaudador(a) de peaje | Infraestructura vial | operativo | manejo_dinero, calculo_vuelto |
| `sint_posventa_tienda` | Asesor(a) de atención al cliente en tienda (posventa) | Retail | operativo | atencion_cliente, comunicacion |
| `sint_produccion_empaque` | Operario(a) de producción y empaque | Manufactura | operativo | protocolos, org_productos |
| `sint_promotor_tarjetas` | Promotor(a) de tarjetas de crédito en tienda | Servicios financieros | operativo | ventas, comunicacion, medios_pago |
| `sint_puesto_mayorista` | Vendedor(a) de puesto en mercado mayorista | Comercio mayorista | operativo | ventas, atencion_cliente, org_productos |
| `sint_recaudador_municipal` | Recaudador(a) en ventanilla de pagos municipales | Sector público | operativo | manejo_dinero, registro_transacciones, atencion_cliente |
| `sint_remesas` | Operador(a) de agencia de transferencias y remesas | Servicios financieros | operativo | manejo_dinero, registro_transacciones, medios_pago |
| `sint_secretaria_academica` | Asistente de secretaría académica | Educación | operativo | registro_info, org_documentos, atencion_cliente |
| `sint_stand_centro_comercial` | Vendedor(a) de stand en centro comercial | Retail | operativo | ventas, atencion_cliente, org_productos |
| `sint_steward` | Steward (lavado de vajilla y utensilios) | Gastronomía | operativo | protocolos, uso_productos, org_materiales |
| `sint_stock_tienda_departamentos` | Auxiliar de stock en tienda por departamentos | Retail | operativo | reposicion, org_productos |
| `sint_televentas` | Ejecutivo(a) de televentas | Servicios | operativo | ventas, comunicacion |
| `sint_tienda_ropa` | Asistente de ventas en tienda de ropa | Retail de moda | operativo | atencion_cliente, ventas, org_productos |
| `sint_trabajo_hogar` | Trabajador(a) del hogar | Servicio doméstico | operativo | uso_productos, org_materiales, control_suministros |
| `sint_tramitador` | Gestor(a) de trámites y mensajería | Servicios empresariales | operativo | org_documentos, coordinacion |
