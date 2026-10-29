# Integración con QVAC

Fuente: documentación oficial de QVAC, corpus `llms-full.txt` con
`@qvac/sdk` **v0.22** y `@qvac/cli` **v0.16** (revisado el 2026-10-27).
Cada afirmación lleva la página de origen. Antes de implementar, confirma que
la versión instalada coincide (`npm ls @qvac/sdk`). Si no coincide, vuelve a
leer la página correspondiente de esa versión.

## Contenido

1. Qué es y qué no es QVAC
2. Dónde corre (y por qué KALLPA necesita un backend)
3. Dos formas de usarlo: SDK o servidor HTTP
4. Capacidades relevantes para KALLPA
5. Modelos
6. Límites y errores a tener en cuenta
7. Pendiente de verificar
8. Lo que NO se debe asumir

---

## 1. Qué es y qué no es QVAC

- Es un runtime de IA **local**. Carga modelos GGUF desde una ruta local, una
  URL HTTP o el registro distribuido de QVAC, y ejecuta la inferencia en el
  equipo (`/sdk`).
- Los paquetes **no incluyen modelos**: exponen constantes como
  `QWEN3_600M_INST_Q4` que apuntan al registro (`/sdk#models`).
- **No incluye conocimiento laboral, taxonomías de competencias ni un
  clasificador entrenado para competencias.** Los modelos son genéricos (LLM,
  embeddings y decisiones). El conocimiento de KALLPA hay que construirlo y
  suministrarlo.

## 2. Dónde corre

- El cliente JS/TS (`@qvac/sdk`) corre en **Node.js ≥ v22.17**, Bare
  ≥ v1.30.3 y Expo. No se documenta soporte para navegador (`/sdk/js-ts-sdk`).
- En Windows 10+ x64 se requiere **Vulkan ≥ 1.4 incluso para inferencia solo
  con CPU**. En Linux, si falta Vulkan, recurre a la CPU
  (`/sdk/system-requirements`).
- Flujo de vida: `loadModel()` → tarea (`completion()`, `embed()`,
  `decide()`…) → `unloadModel()` → `close()` (`/sdk`).

**Consecuencia para KALLPA:**

- `package.json` del frontend declara `@qvac/sdk` como dependencia, pero
  ningún archivo de `src/` lo importa. Además, `engines.node` admite
  `^20.19.0`, que es menor que el mínimo de QVAC. El SDK debe vivir en un
  **backend Node ≥ 22.17** (paquete aparte, por ejemplo `server/`). Hay que
  quitarlo del bundle de Vite.
- El frontend sigue llamando a `VITE_KALLPA_API_URL` por medio de
  `qvacAdapter.js`.

## 3. Dos formas de usarlo

### A. SDK dentro del backend de KALLPA (recomendado)

El backend importa `@qvac/sdk` y expone los endpoints del contrato
(`/diagnosis/*`, `/profile/*`, `/occupations/compare`, `/route`,
`/jobs/recommend`, `/demand/*`). Ventaja: la lógica de negocio, la
validación y el acceso a la base de conocimiento quedan en un solo lugar.

### B. Servidor HTTP de la CLI (`@qvac/cli`) como proveedor de modelos

- `qvac serve --openai` monta una API compatible con OpenAI en
  `http://localhost:11434/v1/` (`/cli/http-server`).
- Endpoints relevantes: `/v1/chat/completions`, `/v1/responses`,
  `/v1/embeddings`, `/v1/decisions`, `/v1/files`, `/v1/vector_stores`.
- Los modelos se declaran en `qvac.config.json` bajo `serve.models` (alias →
  constante). Las peticiones deben indicar `model`; `default: true` **no** lo
  rellena.
- **Contexto LLM por defecto: 1024 tokens.** Configura `config.ctx_size`.
- CORS está desactivado salvo `--cors-origin <origen>`. Por defecto escucha
  en `127.0.0.1`. Usa `--api-key` si se expone.

Esta opción sirve para que un backend en otro lenguaje use QVAC. **No la
expongas directamente al navegador**: las reglas de negocio quedarían en el
cliente.

## 4. Capacidades relevantes

### 4.1 Embeddings — `/sdk/ai-capabilities/text-embeddings`

```js
const modelId = await loadModel({ modelSrc: GTE_LARGE_FP16 }); // embeddings
const { embedding } = await embed({ modelId, text: 'una frase' });        // number[]
const { embedding: many } = await embed({ modelId, text: ['a', 'b'] });   // number[][]
```

- Acepta cualquier modelo de embeddings GGUF compatible con llama.cpp
  (`modelType: "embeddings"`).
- `GTE_LARGE_FP16` produce vectores de **1024 dimensiones** (`/sdk/ai-capabilities/rag`).

### 4.2 RAG y almacenamiento vectorial — `/sdk/ai-capabilities/rag`

Hay tres opciones documentadas:

| Opción | Funciones | Persistencia | Uso en KALLPA |
| --- | --- | --- | --- |
| Base vectorial externa | `embed()` + tu base de datos (SQLite‑vector, MongoDB, LanceDB, Chroma…) | La de tu base de datos | **Producción** |
| Índice TurboVec con tus propios documentos | `createVectorIndex()`, `index.add/search/write`, `loadVectorIndex()` | Solo vectores, en un snapshot `.qvi` | Prototipo o caché de búsqueda |
| Almacén integrado | `ragIngest`, `ragSearch`, `ragChunk`, `ragSaveEmbeddings`, `ragDeleteEmbeddings`, workspaces | Gestionada por QVAC | **Solo prototipo**: la documentación dice que "no es de nivel producción" |

Detalles de TurboVec: la dimensión debe ser divisible por 8 y ≤ 1024. Por
defecto usa `VectorIndexStorage.TURBOVEC_Q4` (`TURBOVEC_Q2` usa la mitad de
memoria). La búsqueda usa **producto punto**, así que hay que **normalizar
con L2** si se quiere similitud coseno. El índice vive en el worker:
**se pierde si el worker se reinicia** y hay que reabrirlo desde el snapshot.
`search()` devuelve `{ id, score }` con los ids que asignaste tú.

`ragChunk({ documents, chunkOpts: { chunkSize, chunkOverlap, chunkStrategy: 'paragraph' } })`
existe para trocear documentos largos.

La recuperación **no** genera la respuesta. RAG = recuperar fragmentos y
pasarlos como contexto a `completion()`.

### 4.3 Generación de texto — `/sdk/ai-capabilities/text-generation`

```js
const modelId = await loadModel({
  modelSrc: QWEN3_1_7B_INST_Q4,
  modelConfig: { ctx_size: 4096, tools: true },
});
const run = completion({ modelId, history, stream: true, tools });
for await (const ev of run.events) { /* contentDelta, toolCall, toolError, completionDone… */ }
const final = await run.final; // contentText, thinkingText, toolCalls, toolErrors, stats
```

- `history`: mensajes con `role` `system` | `user` | `assistant` | `tool`.
- **Herramientas como salida estructurada**: los `parameters` de una
  herramienta son un JSON Schema (o Zod) que se pasa tal cual. Con
  `generationParams.tool_choice: "required"` o con el nombre de una
  herramienta, el muestreo queda **restringido por la gramática** de
  llamadas a herramientas: o devuelve la llamada o la petición falla. Los
  errores de parseo o validación llegan como `toolError` / `final.toolErrors`.
  Requiere cargar el modelo con `modelConfig.tools: true`.
- `responseFormat` (`json_object` / `json_schema`) está documentado para
  `batchCompletion()` (por cada prompt) y, en HTTP, como `response_format` de
  `/v1/chat/completions`. **No se puede combinar con `tools`.**
- Modelos con razonamiento híbrido: con salida estructurada y un
  `max_tokens` ajustado puede quedar `content` vacío. En HTTP se evita con
  `reasoning_budget: false`.
- `modelConfig.parallel ≥ 2` permite completions concurrentes y
  `batchCompletion()`.

### 4.4 Decisiones — `/sdk/ai-capabilities/decisions`

> **Estado en KALLPA:**
> - Clasificación evidencia–competencia: evaluada y **no adoptada**; en las
>   pruebas disponibles no superó al flujo actual (`docs/decisions-evaluacion.md`).
> - Siguiente acción de la entrevista: **implementada y desactivada**
>   (`KALLPA_INTERVIEW_ACTIONS=decisions`, `server/interview/actions.js`); no
>   mejoró al flujo actual (`docs/interview-actions-evaluacion.md`).
>
> Comprobado en 0.22: `decide({ modelId, state, questions })` con `choice`
> (`criteria` como lista o como objeto), `noul` y `score`; `loadModel` con
> `modelType: 'llamacpp-decision'` y `modelConfig: { device }`. Antes de proponer integrarlo, vuelve a
> ejecutar `npm run eval:decisions` con la nueva versión y compáralo con esas tablas.

Modelos Laya (`LAYA_MULTILINGUAL_322M_Q8_0`, etc.) con
`modelType: 'llamacpp-decision'`.

```js
const r = await decide({
  modelId,
  state: 'texto de la persona',
  questions: {
    hasConcreteExample: { type: 'noul', instructions: 'El texto describe una tarea concreta con frecuencia, pasos o resultado.' },
    family: { type: 'choice', instructions: '¿De qué área habla?', criteria: ['organizacion', 'inventario', 'higiene', 'servicio', 'dinero', 'informacion'] },
    detail: { type: 'score', instructions: '¿Qué tan concreto es el relato?', criteria: ['vago', 'algo concreto', 'muy concreto'] },
  },
});
// r.answers.<id> con confianza; r.usage.truncated / truncatedQuestions / stateTokensDropped
```

- Tipos de pregunta: `choice` (etiqueta y probabilidad por etiqueta), `score`
  (nivel ordinal esperado) y `noul` (probabilidad de que un enunciado sea
  cierto). `states` evalúa varios textos en una sola petición.
- `action.actProbability` **no tiene señal utilizable** y no debe decidir
  acciones de la aplicación.
- La confianza de Laya se basa en la entropía y **no está calibrada**. Hay
  que calibrar umbrales con el conjunto de referencia de KALLPA.
- Hay una petición activa por modelo y una cola FIFO de 64. Si se llena,
  lanza `RequestRejectedByPolicyError` (HTTP 429).
- Es útil para **compuertas** baratas: ¿el ejemplo es concreto? ¿habla de la
  competencia preguntada? ¿la respuesta es ambigua? No sirve para extraer
  citas ni para elegir entre más de 255 opciones (límite de HTTP `choice`).

### 4.5 Fine‑tuning (LoRA) — `/sdk/ai-capabilities/fine-tuning`

Existe `finetune()` (SFT o causal) para arquitecturas `qwen3`, `gemma3` y
`bitnet` con cuantización F32/F16/Q4_0/Q8_0/TQ1_0/TQ2_0. **No es necesario
para empezar.** Solo tiene sentido con un conjunto etiquetado y validado por
personas, y después de medir que el modelo base con RAG y reglas no basta.
Los embeddings **no** son entrenamiento: no cambian el modelo.

## 5. Modelos (constantes citadas en la documentación)

| Uso | Constante | Nota |
| --- | --- | --- |
| Embeddings | `GTE_LARGE_FP16` | 1024 dimensiones. **Solo inglés** según su ficha (thenlper/gte-large): descartado para KALLPA |
| Embeddings | `EMBEDDINGGEMMA_300M_Q8_0` | **En uso** (verificado 2026-10-27): 768 dimensiones, vectores ya normalizados, multilingüe (100+ idiomas). Requiere prefijos de tarea (`title: … \| text: …`, `task: search result \| query: …`). También hay Q4_0, BF16 y F32 |
| LLM | `QWEN3_600M_INST_Q4`, `QWEN3_1_7B_INST_Q4`, `LLAMA_3_2_1B_INST_Q4_0`, `QWEN3_4B_INST_Q4_K_M` | El 1.7B aparece en el ejemplo de herramientas |
| Decisiones | `LAYA_MULTILINGUAL_322M_Q8_0` (y F16), `LAYA_421M_*`, `LAYA_TYPED_DECISIONS_421M_*` | La versión multilingüe es la candidata para español |

Lista completa:
https://github.com/tetherto/qvac/blob/main/packages/sdk/models/registry/models.ts
y `modelRegistrySearch()`. Antes de descargar, usa `assessModelFit()`.

## 6. Límites y errores

- Cancelación: la promesa expone `requestId` y se cancela con
  `cancel({ requestId })`. Al cancelar, rechaza con `InferenceCancelledError`.
- Al cambiar de modelo de embeddings hay que **re‑embeber todo**: los vectores
  de modelos distintos no son comparables. Guarda `embeddingModel` y `dim`
  junto a cada vector.
- La primera carga descarga el modelo (cientos de MB). Precárgalo al
  arrancar el backend; no lo hagas en la primera petición de una persona.

## 7. Pendiente de verificar (no implementar sin confirmarlo)

- ~~Si `completion()` del SDK (no batch) acepta `responseFormat` en v0.22.~~
  **Verificado (2026-10-27)** en `@qvac/sdk` 0.22.0 instalado: el JSDoc de
  `completion()` (`@qvac/inference/dist/api/completion-stream.d.ts`) y el
  ejemplo `dist/examples/llamacpp-structured-output.js` documentan
  `responseFormat` `text` | `json_object` | `json_schema` (no combinable con
  `tools`). La entrevista de KALLPA (`server/interview/`) lo usa y se probó
  con `QWEN3_4B_INST_Q4_K_M` y `QWEN3_8B_INST_Q4_K_M`.
- ~~Si `embed()` devuelve vectores normalizados.~~ Con EmbeddingGemma Q8_0
  sí (norma 1,0000, verificado). El código normaliza igual por si cambia el modelo.
- Qué modelos de embeddings y LLM rinden bien en **español peruano coloquial**.
  Mídelo con el conjunto de referencia (`evaluation.md`).
- Requisitos de memoria y latencia en el hardware donde se desplegará el backend.
- Si el backend del MTPE permite Node ≥ 22.17 y Vulkan (Windows).

## 8. Lo que NO se debe asumir

- Que QVAC "sabe" qué competencias tiene una ocupación.
- Que la puntuación de similitud equivale a una probabilidad o a evidencia.
- Que el almacén integrado (`ragIngest`) sirve para producción.
- Que existen funciones o parámetros que no aparecen en `/sdk/reference/api`
  de la versión instalada.
