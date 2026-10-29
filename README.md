# KALNA

**KALNA**, anteriormente llamado **KALLPA** (“fuerza”, en quechua), ayuda a personas con experiencia laboral —formal o informal— a **reconocer, desarrollar y aprovechar sus competencias** dentro de **cinco ocupaciones**:

> **Nota:** El nombre actual del proyecto es **KALNA**. Los archivos, las variables y las referencias internas conservan el nombre **KALLPA** para mantener la configuración existente y evitar cambios innecesarios en su funcionamiento.

1. Personal de limpieza
2. Auxiliar administrativo
3. Reponedor y abastecedor
4. Vendedor de tienda
5. Cajero

> El alcance es cerrado: la plataforma no propone otras ocupaciones. Todas las preguntas, competencias, comparaciones, historias y rutas se refieren solo a estas cinco.

El flujo completo es: **entrevista conversacional → perfil de competencias con evidencias → puestos recomendados → ruta de empleabilidad → CV**.

| Parte | Tecnología | Dónde |
| --- | --- | --- |
| Interfaz | React 19 + Vite (HashRouter) | `src/` |
| API | Node.js ≥ 22.17, `node:http` | `server/` |
| Entrevista y extracción de competencias | QVAC Text Generation (`QWEN3_4B_INST_Q4_K_M`) | `server/interview/`, `server/competencies/` |
| Búsqueda semántica | QVAC Text Embeddings (`EMBEDDINGGEMMA_300M_Q8_0`, 768 dimensiones) + pgvector | `server/embeddings/`, `server/matching/` |
| Datos | PostgreSQL 18 + pgvector (local en Docker) | `server/db/` |

Hay dos modos (`VITE_KALLPA_MODE`):
- `qvac`: el modo real, con backend, QVAC y PostgreSQL.
- `mock`: un motor de reglas local, sin backend, con un catálogo pequeño de puestos de ejemplo.

El **modo demostración** (botón «Ver demostración») siempre es local y usa un caso ficticio.

**Catálogo:** los 50 puestos son **sintéticos**, de referencia y no son ofertas reales. KALLPA no inventa vacantes, salarios, empresas ni cursos.

---

## Requisitos

- **Node.js 20.19 o superior** (recomendado: Node 22 LTS). Comprueba tu versión con `node -v`.
- **npm** (viene con Node.js).
- Recomendado: **Visual Studio Code**.

## Instalación y ejecución

```bash
# 1. Entra a la carpeta del proyecto
cd KALLPA

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Inicia el servidor de desarrollo
npm run dev
```

Se abrirá el navegador en **http://localhost:5173**. Si no se abre solo, copia esa dirección en tu navegador.

### Otros comandos

| Comando           | Para qué sirve                                                       |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con recarga automática.                       |
| `npm run build`   | Genera la versión de producción en la carpeta `dist/`.               |
| `npm run preview` | Sirve localmente la versión de `dist/` para revisarla.               |
| `npm run lint`    | Revisa el código con ESLint.                                         |
| `npm test`        | Pruebas unitarias y de integración sin servicios externos.           |
| `npm run server`  | Backend con la base de `.env` (PostgreSQL local).                    |
| `npm run test:db` | Pruebas contra el PostgreSQL local. Crean y borran solo sus perfiles de prueba. |
| `KALLPA_QVAC_LIVE=1 npm run test:qvac` | Entrevista con Qwen real (6 perfiles). |
| `KALLPA_QVAC_LIVE=1 npm run test:embeddings` | Embeddings y búsqueda con QVAC y PostgreSQL reales. |

Para abrirlo en VS Code: abre la carpeta `KALLPA` (o ejecuta `code .` dentro de ella). VS Code te sugerirá instalar las extensiones recomendadas (ESLint y Prettier).

---

## Qué incluye

| Sección | Ruta | Qué hace |
| --- | --- | --- |
| **Inicio** | `#/` | Presenta KALLPA, su alcance (las cinco ocupaciones), cómo funciona, cómo leer los estados y los compromisos éticos. |
| **Diagnóstico** (chatbot) | `#/diagnostico` | Conversación guiada en 6 pasos: experiencia (ocupación, formal/informal, tiempo), tareas, herramientas, responsabilidades, situaciones resueltas y ejemplos. Reconoce competencias potenciales **solo a partir de lo que la persona cuenta** y pide ejemplos concretos para respaldarlas. Incluye respuestas rápidas, sugerencias, entrada por voz (si el navegador la admite) y panel en vivo “Lo que voy reconociendo”. |
| **Mi perfil** | `#/perfil` | Competencias agrupadas por familia con su estado (**Con evidencia / Declarada / Por validar**), lo que la persona contó y sus ejemplos. Permite agregar ejemplos y quitar competencias que no la representan (con deshacer). |
| **Puestos** | `#/ocupaciones` | **Seis puestos recomendados para postular** según las competencias del perfil (pueden estar fuera de las cinco ocupaciones; catálogo de 18 puestos en `data/jobs.js`), cada uno con botón **“Postular en Empleos Perú”**. También aparecen (tres) en *Mi ruta* y en el *Pasaporte*. |
| **Mi ruta** | `#/ruta` | Se crea con «Crear mi ruta» en la tarjeta de un puesto. Tiene 4 etapas: respaldar lo que ya sabes, desarrollar las brechas por prioridad, preparar la postulación y buscar y postular. Los pasos se pueden marcar. Con backend, la ruta y el avance se guardan en PostgreSQL (`employability_routes`) y se recuperan al recargar o desde otro navegador. |
| **Mi CV** | `#/cv` | Formulario validado (datos, experiencias formales e informales, estudios y certificaciones), vista previa y **«Descargar PDF»** con la impresión del navegador. Solo muestra como competencias las que tienen **evidencia**, con su ejemplo real. Las declaradas aparecen solo si la persona lo pide, en una sección aparte, y las «por validar» nunca. Las secciones vacías se omiten y se listan como pendientes. Con backend se guarda en `profile_cv`. |
| **Pasaporte** | `#/pasaporte` | Resumen imprimible (PDF), copiable y descargable (JSON) de competencias y evidencias. Indica claramente que **no es una certificación oficial**. |
| **Modo demostración** | Botón “Modo demostración” | Caso completo y ficticio de **María** (limpieza → reponedora y abastecedora) en 9 pasos, con reproducción automática, pausa y navegación. Usa el mismo motor que las personas reales y **no modifica** los datos guardados. |

### Principios aplicados en toda la interfaz

- **No asumir:** trabajar en una ocupación no implica tener sus competencias; se reconocen por el relato y los ejemplos.
- **No certificar:** los estados indican cuánto respaldo tiene cada competencia, no una certificación.
- **No inventar demanda ni vacantes:** la sección “Demanda laboral regional” muestra “sin datos” hasta conectar una fuente oficial. KALLPA recomienda **puestos**, no avisos: la postulación se hace en Empleos Perú (`VITE_EMPLEOS_PERU_URL`; con `VITE_EMPLEOS_PERU_SEARCH_URL="…{q}…"` el botón abre directamente la búsqueda del puesto). Los demás enlaces van a portales públicos (Capacíta-T).
- **Ficción identificada:** las historias, personas y el caso de demostración están marcados como ficticios.
- **Privacidad:** en modo demostración todo se guarda solo en el navegador (`localStorage`, clave `kallpa:v1`). El botón “Borrar mis datos” lo elimina.

---

## Estructura del proyecto

```
KALLPA/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── .env.example                 ← variables para cambiar a modo QVAC
├── public/favicon.svg
├── tests/engine.test.js         ← pruebas del motor (npm test)
├── docs/DISENO.md               ← sistema de diseño (tokens, tipografía, reglas)
└── src/
    ├── main.jsx                 ← punto de entrada (fuentes y estilos globales)
    ├── App.jsx                  ← rutas
    ├── styles/                  ← tokens.css, base.css, components.css, print.css
    ├── state/                   ← estado global (KallpaProvider, useKallpa, storage)
    ├── hooks/                   ← useAsync, useSpeechInput, useDemoAnchor, …
    ├── data/                    ← catálogos de demostración
    │   ├── occupations.js       ← las 5 ocupaciones de referencia y sus competencias
    │   ├── jobs.js              ← puestos para recomendar postulaciones (enlazan a Empleos Perú)
    │   ├── competencies.js      ← 20 competencias, señales de detección, bases y actividades
    │   ├── demoCase.js          ← caso ficticio de María
    │   ├── demoSteps.js         ← guion del modo demostración
    │   └── resources.js         ← enlaces a portales públicos
    ├── services/
    │   ├── kallpaService.js     ← ÚNICO punto de acceso a datos para las pantallas
    │   ├── config.js            ← lee VITE_KALLPA_MODE y VITE_KALLPA_API_URL
    │   ├── adapters/
    │   │   ├── mockAdapter.js   ← motor local de demostración (activo por defecto)
    │   │   └── qvacAdapter.js   ← ★ AQUÍ se conecta el backend y QVAC
    │   └── engine/              ← motor de reglas: diagnóstico, extracción, evidencia,
    │                              comparación, ruta y resumen
    ├── components/              ← layout, chat, mapa, perfil y componentes de interfaz
    └── pages/                   ← una página por sección (+ su CSS)
```

---

## Entrevista adaptativa con QVAC (`server/`)

En modo `qvac`, el diagnóstico usa un backend Node (**≥ 22.17**) que ejecuta la generación de texto de QVAC (`@qvac/sdk` 0.22.0) en el equipo. El navegador nunca carga el modelo.

```bash
# Terminal 1: backend (la primera vez descarga el modelo, ≈ 2,5 GB, a ~/.qvac)
npm run server
# Terminal 2: frontend con VITE_KALLPA_MODE=qvac en .env
npm run dev
```

- Bienvenida, nombre, ocupación, formalidad y tiempo siguen el motor de reglas. Después empieza la etapa `entrevista`. Cada turno hace dos llamadas a QVAC con `responseFormat: json_schema`: **notas** (qué registra de la última respuesta) y **pregunta** (la siguiente pregunta o el cierre). Cada llamada recibe por separado las instrucciones (`server/prompts/*.v2.md`), el diálogo y el estado estructurado de la entrevista.
- El modelo se elige con `KALLPA_LLM_MODEL` (constante de `@qvac/sdk`). Por defecto, `QWEN3_4B_INST_Q4_K_M`. `QWEN3_8B_INST_Q4_K_M` dio mejores preguntas en las pruebas, pero tarda el doble y pesa unos 5 GB.
- El código valida cada turno antes de mostrarlo: citas literales, una sola pregunta, sin preguntas sesgadas ni repetidas, seguimiento apoyado en las palabras de la persona y sin cierre prematuro ni justo cuando aparece un tema nuevo. Si rechaza una salida, reintenta una vez; si vuelve a fallar, usa una pregunta de referencia del taller, marcada como `origen: 'guia'`.
- El estado (`session.interview`) separa **lo que dijo** la persona, las **evidencias**, las **interpretaciones** (siempre hipótesis) y lo que **falta saber**.
- Si QVAC falla o aún carga, la API responde 503 y la sesión no cambia: «Reintentar» reenvía la misma respuesta.
- `GET /api/health` muestra el estado del modelo.
- Pruebas: `npm test` (lógica, con un modelo **simulado**) y `KALLPA_QVAC_LIVE=1 npm run test:qvac` (QVAC **real**).

## Identificación de competencias con QVAC (`server/competencies/`)

Al cerrarse la entrevista (la cierra el modelo, el límite de turnos o la persona), el backend analiza **una sola vez** el diálogo de la sesión con el mismo modelo de QVAC, con un prompt propio (`server/prompts/competencies.v1.md`) y salida `json_schema` (`schema.js`). No se ejecuta en cada mensaje.

- El modelo propone; el código decide (`validate.js`): solo ids del catálogo, citas **literales** de la persona (no del entrevistador ni solo el nombre de la ocupación), «Con evidencia» solo con un hecho concreto, «Declarada» con una afirmación, «Por validar» con indicios. El código nunca sube el estado propuesto. El nivel (`basico`/`intermedio`/`avanzado`, escala provisional) solo se conserva con evidencia y justificación; si no, `null`.
- Nombre y descripción salen del catálogo, no del modelo. También devuelve `missing_information` (lo que falta saber).
- JSON inválido → un reintento con la corrección. Si vuelve a fallar o QVAC no responde, el diagnóstico sigue con lo que reconoció el motor de reglas y la persona ve un aviso.
- El resultado se fusiona con el perfil sin bajar estados (`merge.js`) y aparece en el chat, en «Lo que voy reconociendo» y en *Mi perfil* (nivel y «Lo que falta saber»).

## Embeddings con QVAC Text Embeddings (`server/qvac/embeddings.js`, `server/embeddings/`)

- **Modelo:** `EMBEDDINGGEMMA_300M_Q8_0` (google/embeddinggemma-300m, Q8_0, 0,31 GiB; versión = SHA-256 `a0f7b4e1…4969b` del registro de QVAC). Multilingüe (más de 100 idiomas). **768 dimensiones**, verificado con el modelo real. Se descartó `GTE_LARGE_FP16` porque su ficha indica que solo admite inglés. Se cambia con `KALLPA_EMBED_MODEL`.
- **Ciclo de vida:** se carga una vez al arrancar (después del LLM) y se reutiliza; las peticiones van en cola y por lotes; cada vector se valida (finito, dimensión coherente) y se normaliza con L2.
- **Texto de cada competencia** (`texts.js`): catálogo = nombre + área + descripción (formato de documento `title: … | text: …`); perfil = nombre + descripción + hasta 3 citas reales de la persona (formato de consulta `task: search result | query: …`). El texto legible se guarda junto al vector.
- **Cuándo:** al guardar un perfil, en segundo plano (la respuesta no espera). Solo se regenera si cambia el hash (modelo + formato + texto). Si falla, `profile_competencies.embedding_status = 'error'` con el motivo; `generado` se marca en la misma transacción que el vector. Reintentos: al arrancar, al volver a guardar o con `POST /api/profile/:id/embeddings`.
- Pruebas reales: `KALLPA_QVAC_LIVE=1 npm run test:embeddings`.

## Búsqueda semántica y compatibilidad laboral (`server/matching/`)

`POST /api/jobs/recommend` usa los **50 empleos sintéticos de PostgreSQL** (ya no `src/data/jobs.js`) en dos pasos separados:

1. **Recuperación híbrida** (pgvector, mismo modelo, versión y formato): empleos que requieren una competencia del perfil, empleos a los que se puede **transferir** (relación `bases` del catálogo o similitud entre competencias ≥ 0,70) y empleos con alguna **tarea** parecida a una evidencia de la persona (≥ 0,535).
2. **Compatibilidad explicable** (`compatibility.js`, `compat-v3`): cobertura ponderada de las competencias requeridas (clave 1, complementaria 0,5) × respaldo (evidencia 1 · declarada 0,7 · por validar 0,4); transferible como máximo 0,5 (`bases`) o 0,15–0,35 (semántica); «posible, por confirmar» 0,15. Bandas: **alta** (≥ 0,6, todas las clave cubiertas, al menos una con evidencia y sin certificación o licencia pendiente), **media** (≥ 0,35 y una coincidencia directa), **exploratoria** (≥ 0,15). Los requisitos sin verificar no restan: se muestran «por verificar».

- Al cerrar la entrevista, las frases de la persona se comparan con las **referencias** de las competencias (descripción + indicadores + ejemplos cotidianos, `server/catalog/competency-references.js`, `referencias-v1`, demo) y las candidatas llegan como **pistas** al análisis con QVAC; la validación en código decide. Las no validadas quedan «por confirmar».
- Umbrales calibrados con `npm run matching:calibrate` sobre `calibration-cases.js` (detalle en `config.js`). La similitud nunca se muestra como porcentaje.
- Las competencias descartadas no se usan; `PUT /api/profile` las guarda en PostgreSQL.
- Si la persona tiene la competencia (aunque sea «por validar»), cuenta como coincidencia directa con su estado real; una transferencia no la reemplaza.
- Orden dentro de cada banda: cobertura + 0,1 × relevancia semántica, que es la mayor entre las tareas (≥ umbral) y la descripción general del empleo (normalizada entre candidatos). La descripción solo ordena: sus valores absolutos se solapan con frases sin relación, así que no crea candidatos.
- Modo `qvac`: la página *Puestos* llama a `POST /api/jobs/recommend` y lo indica en su subtítulo; si el servidor falla, muestra el error. Modo `mock`: puestos de ejemplo locales (`src/data/jobs.js`), sin backend, también indicado en la página y en el pie.
- Las tarjetas de *Puestos* muestran banda, barra y «Ya tienes» calculados por el backend, sin enlace de postulación (son empleos de referencia).

```bash
npm run embeddings:index        # referencias, 50 empleos (+ tareas) y evidencias pendientes
KALLPA_QVAC_LIVE=1 npm run test:embeddings   # pruebas con QVAC y PostgreSQL reales
```

### QVAC Decisions (Laya): retirado

KALLPA **no usa QVAC Decisions**. Se evaluó para dos tareas y en ninguna superó al flujo actual en las pruebas disponibles:
1. Clasificar la relación evidencia–competencia: ver `docs/decisions-evaluacion.md`.
2. Elegir la siguiente acción de la entrevista: ver `docs/interview-actions-evaluacion.md`.

El código y los conjuntos de evaluación se conservan solo como registro histórico en `eval/`. La aplicación no los importa, no hay comandos ni variables para activarlos y el servidor no carga ningún modelo de Laya.

## Catálogo sintético de empleos (`server/catalog/`)

Una sola colección plana de **50 empleos sintéticos** distintos (`sintetico-v2`, seleccionados de 100: ver `docs/catalogo-sintetico-seleccion.md`), en `server/catalog/synthetic-jobs.js`, sin agrupaciones por perfiles, sectores ni categorías. Cada empleo tiene `id`, `title`, `description`, `tasks` (funciones principales), `responsibilities`, `competencies` (ids del catálogo, clave o complementaria) y `requirements`; `sector` y `level` son solo atributos.

```bash
npm run catalog:synthetic   # valida y carga (idempotente) en PostgreSQL
```

- `validateCatalog()` exige exactamente 50 empleos, ids y nombres únicos, competencias del catálogo, funciones no casi idénticas y ningún enlace.
- Se guardan en `occupations` (`is_synthetic = true`, `scope = 'synthetic'`), `occupation_competencies` y `occupation_requirements`.
- No son vacantes: sin empresa, fecha ni enlace. No se deben mostrar como ofertas disponibles.

## PostgreSQL (`server/db/`)

La base guarda información útil para la empleabilidad, **no transcripciones**: las conversaciones del chatbot viven solo en la memoria del servidor y en el navegador. `DATABASE_URL` va solo en `.env`.

```bash
npm run db:migrate   # aplica server/db/migrations/*.sql (el servidor también migra al arrancar)
npm run test:db      # prueba el esquema contra la base real (sin dejar datos)
```

| Migración | Qué hace |
| --- | --- |
| `001_conversations.sql` | Histórica: creó `conversations` y `conversation_messages`. |
| `002_drop_conversations.sql` | Elimina esas dos tablas (sin `CASCADE`). |
| `003_employability.sql` | Esquema de empleabilidad (abajo). |
| `004`–`008` | Análisis de competencias, embeddings, catálogo sintético y búsqueda semántica (abajo). |
| `009_routes_and_cv.sql` | `employability_routes` (ruta y avance por perfil y puesto) y `profile_cv` (datos del CV). Solo crea tablas nuevas. |

- **Catálogo:** `competency_families`, `competencies`, `occupations` (`scope`: `reference` o `job`), `occupation_competencies` (`clave`/`complementaria`). Con los mismos ids de `src/data` y la procedencia (`validation`: `demo` → `revisado` → `fuente_oficial`).
- **Perfil laboral:** `job_profiles` → `profile_competencies` (estado `por_validar`/`declarada`/`evidencia`; `level` solo si hay evidencia) → `competency_evidence` (cita textual o ejemplo, con su calidad). Borrar un perfil borra sus competencias y evidencias.
- **Embeddings:** `competency_embeddings` y `occupation_embeddings` guardan el texto exacto junto a su vector (`pgvector`), con `model`, `dim` y `text_hash`. La dimensión no está fijada hasta elegir el modelo de embeddings de QVAC.
- `004_competency_analysis.sql`: metadatos del análisis en `job_profiles`, `level_reason`, `origin` (`reglas`/`qvac`/`persona`) y `quote_type` de cada evidencia, y un índice único que evita duplicarlas.
- El backend copia el catálogo de `src/data/competencies.js` al arrancar y guarda el **perfil** (no la conversación) al generarlo, al terminar el diagnóstico y al agregar un ejemplo desde *Mi perfil*. Esas respuestas traen `persistence: { saved, profileId?, error? }`; si falla, la interfaz lo avisa. `GET /api/profile/:profileId` lo recupera.
- `005_embeddings.sql`: `model_version` e `input_format` en los embeddings del catálogo, un vector vigente por texto/modelo/formato, la tabla `profile_competency_embeddings` (vector por competencia de cada perfil) y el estado de generación en `profile_competencies`. La columna `vector` no fija dimensión (cada fila guarda `dim` y una restricción la comprueba); el índice HNSW por modelo llega con la búsqueda.
- `006_synthetic_catalog.sql`: columnas de empleo sintético en `occupations` (sector, descripción, tareas, responsabilidades, nivel, `is_synthetic`, `catalog_version`) y `occupation_requirements`. También creó tablas de perfiles de origen, retiradas en `007_flat_synthetic_catalog.sql`.
- `008_semantic_search.sql`: varios vectores por competencia y por empleo (`chunk`), `reference_version`, y `evidence_embeddings` (un vector por cita de la persona). `profile_competency_embeddings` (005) se conserva pero ya no se escribe.

## Cómo conectar el backend y QVAC (contrato)

**Archivo a modificar: `src/services/adapters/qvacAdapter.js`.**

Todas las pantallas llaman a `src/services/kallpaService.js`, que elige el adaptador según la variable de entorno. El adaptador QVAC ya tiene el contrato y las llamadas `fetch` escritas; solo falta que el backend implemente los endpoints.

1. Copia `.env.example` como `.env`.
2. Cambia los valores:
   ```env
   VITE_KALLPA_MODE=qvac
   VITE_KALLPA_API_URL=http://localhost:8000/api
   ```
3. Implementa en el backend estos endpoints (el backend es quien llama a QVAC; nunca pongas credenciales en el frontend):

| Método | Endpoint | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/diagnosis/start` | — | `{ session, messages, ui }` |
| POST | `/diagnosis/:sessionId/answer` | `{ input: { text?, choices?, skip? } }` | `{ session, messages, ui }` |
| POST | `/profile/evidence` | `{ profile, competencyId, text }` | `{ profile, level, mismatch? }` |
| POST | `/occupations/compare` | `{ profile }` | `Comparison[]` (las 5 ocupaciones) |
| POST | `/route` | `{ profile, occupationId }` | `Route` + `persistence` y `progress` (se guarda si el perfil existe) |
| GET | `/profile/:id/routes` | — | `[{ occupationId, name, done, total, updatedAt }]` |
| GET | `/profile/:id/routes/:occupationId` | — | `{ route, progress, updatedAt }` |
| PUT | `/profile/:id/routes/:occupationId/progress` | `{ progress }` | `{ progress, updatedAt }` |
| GET / PUT | `/profile/:id/cv` | `{ cv, targetOccupationId }` (PUT) | `{ data, targetOccupationId, updatedAt }`; 400 si no es válido |
| POST | `/jobs/recommend` | `{ profile, limit }` | `JobRecommendation[]` del catálogo sintético en PostgreSQL (sin `url`: no son ofertas) |
| GET | `/demand/:occupationId?region=` | — | `{ available, source, updatedAt, … }` |
| PUT | `/profile` | `{ profile }` | `{ ok, profile }` |

4. Reinicia `npm run dev`.

Las formas de los datos (`Session`, `Profile`, `Competency`, `StageUI`, `Comparison`, `Route`) están documentadas en `qvacAdapter.js` y se pueden ver en ejecución en `src/services/engine/` (el motor de demostración devuelve exactamente esas estructuras). El modo demostración siempre funciona en local, incluso con QVAC activado.

**Otros puntos de extensión**

- Competencias y ocupaciones oficiales (por ejemplo, perfiles del MTPE): `src/data/competencies.js` y `src/data/occupations.js` (o servirlos desde el backend).
- Demanda laboral regional: método `getRegionalDemand` del adaptador; la interfaz ya muestra los datos cuando `available: true`.

---

## Notas

- El motor de demostración usa reglas de texto (no es IA). Su objetivo es mostrar el flujo completo y el contrato de datos.
- Los enlaces externos están en `src/data/resources.js`; verifica que sigan vigentes antes de publicar.
- La app usa `HashRouter`, por lo que el contenido de `dist/` funciona en cualquier servidor estático sin configuración adicional.
- Fuentes incluidas en el proyecto (Lexend y Atkinson Hyperlegible vía `@fontsource`), por lo que no depende de servicios externos.
