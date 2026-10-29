# Pasaporte: valor profesional para un puesto

El pasaporte no es una ruta. Presenta perfil, fortalezas, competencias transferibles, inferencias pendientes de confirmación, valor diferencial y una propuesta de presentación. Omite las secciones sin sustento. Nunca contiene pasos, prioridades, actividades, progreso o un plan de aprendizaje.

## Flujo

1. Solo «Pasaporte para este puesto» llama a `POST /passport` con `profileId` y `occupationId`. El backend recupera el perfil guardado y el puesto del catálogo mediante `routes.loadDestination`, sin generar una ruta.
2. `server/passport/service.js` recupera las citas conservadas en el perfil; no recupera entrevistas completas, que el proyecto deliberadamente no persiste. Excluye las competencias descartadas.
3. Reutiliza `recommender.compare` y `suggest`: EmbeddingGemma compara evidencias, referencias de competencias y tareas con pgvector. El modelo y la versión de los vectores se filtran en `server/matching/semantic.js`. La similitud es una pista, nunca una acreditación.
4. Reutiliza `runCompetencyAnalysis` con el mismo Qwen del diagnóstico, un contexto específico del puesto y el esquema estructurado existente. La validación limita ids al catálogo, comprueba citas literales y ajusta estados según el sustento. Las inferencias nuevas necesitan además una señal del buscador semántico.
5. `passportContent.js` construye una presentación controlada con nombres del catálogo y citas validadas, sin pedir al modelo que invente logros o redacte una ruta. Cada conclusión conserva `sourceIds`. Una fortaleza demostrada exige estado previo `evidencia` y un ejemplo fuerte; la extracción por sí sola nunca la acredita.
6. Las transferencias e inferencias se marcan por confirmar y llevan una pregunta concreta. Aportar un ejemplo abre el flujo existente del perfil. El pasaporte no modifica automáticamente las competencias. Tras aportar información, se vuelve al botón del puesto para regenerarlo.
7. Guarda el documento por perfil y puesto en `employability_passports`. Se conserva el nombre histórico de la columna JSON `route`, sin nuevas tablas o migraciones. La huella incluye versión del pasaporte, perfil, puesto y modelos; evita repetir inferencia si no cambió la entrada. `GET /profile/:id/passports/:occupationId` recupera sin generar.

La versión actual es `valor-profesional-v1`. Los documentos antiguos de actividades no se muestran como pasaportes profesionales y se sustituyen únicamente al pulsar el botón de generación. No se borran rutas ni su progreso. El antiguo endpoint de progreso del pasaporte responde 410; el progreso pertenece a la ruta.

## Capacidades reales y límites

- SDK instalado: `@qvac/sdk` 0.22.0. Generación: `QWEN3_4B_INST_Q4_K_M`; embeddings: `EMBEDDINGGEMMA_300M_Q8_0`, sujetos a la configuración del servidor. `/api/health` informa si están cargados.
- Decisions: no está configurado para este servicio; no se simula ni se activa un modelo por existir una constante en el SDK.
- Recuperación: se reutiliza catálogo y búsqueda semántica existentes. No se incorpora un almacén RAG adicional ni se afirma que QVAC aporta conocimiento laboral.
- Si la inferencia falla, los embeddings no están disponibles o el JSON es inválido tras reintentar, se responde con un error y no se guarda un resultado ficticio.
- Sin relatos suficientes se omiten las presentaciones y se formulan preguntas del catálogo; no se llama al modelo cuando no hay relatos.
- La simulación usa la extracción por reglas y el mismo presentador controlado, con etiqueta explícita y almacenamiento en su perfil separado. No exige base de datos ni se presenta como QVAC.

## Validación

`node --test tests/passport.test.js tests/demo-passport.test.js`: experiencia suficiente y limitada, inferencias por confirmar, citas inventadas, competencias descartadas o ajenas al puesto, aislamiento por puesto, recuperación y errores de modelos. También comprueba que el documento no contiene estructura de ruta ni progreso.

Prueba real opcional en PowerShell: `$env:KALLPA_PASSPORT_LIVE='1'; node --env-file-if-exists=.env --test --test-timeout=240000 tests/passport.live.test.js`. Crea y elimina exclusivamente su perfil temporal en la base configurada, comprueba extracción real con modelos QVAC, presentación respaldada, datos insuficientes y recuperación desde una nueva instancia.

Prueba HTTP con el servidor activo: `$env:KALLPA_PASSPORT_HTTP='1'; node --env-file-if-exists=.env --test --test-timeout=240000 tests/passport.http.test.js`. Recorre recomendaciones, selección de dos puestos, generación bajo demanda y recuperación persistida, usando QVAC y PostgreSQL reales. Crea y elimina solo su propio perfil temporal. No sustituye la revisión visual del navegador.

Referencias oficiales verificadas: [Text generation](https://docs.qvac.tether.io/sdk/ai-capabilities/text-generation/), [Text embeddings](https://docs.qvac.tether.io/sdk/ai-capabilities/text-embeddings/), [API SDK 0.22](https://docs.qvac.tether.io/sdk/reference/api/).
