# Embeddings, recuperación semántica y RAG

Las funciones de QVAC citadas aquí están documentadas en
`qvac-integration.md` §4.1–4.2. Este archivo define **qué** se indexa y
**cómo** se usa en KALLPA.

## Conceptos que no hay que confundir

- **Embedding** ≠ entrenamiento. Convertir texto en vectores no enseña nada
  al modelo. Solo permite medir la cercanía de significado.
- **Índice vectorial** ≠ base de datos. Un índice (TurboVec o el de
  SQLite‑vector) acelera la búsqueda. El texto original, los metadatos, la
  fuente y la validación viven en la base de conocimiento. El índice
  TurboVec guarda solo vectores, y se pierde al reiniciar el worker si no se
  guarda un snapshot.
- **Similitud** ≠ evidencia. Que el relato de la persona se parezca al
  indicador de una competencia solo genera un **candidato**. La decisión
  la toma la clasificación (`classification-rules.md`), con una cita textual.

## Qué se indexa

| Colección | Unidad (un vector por…) | Texto embebido | Metadatos |
| --- | --- | --- | --- |
| `kb_indicator` | indicador observable | `"{competencia}: {indicador}. Ej.: {ejemplo}"` | `competencyId`, `family`, `validation` |
| `kb_competency` | competencia | `"{name}. {description}"` | `id`, `family`, `validation` |
| `kb_occupation` | ocupación o puesto | `"{name}. {summary}"` | `id`, `scope` |
| `kb_resource` | recurso de formación | texto del recurso | `competencyIds`, `type`, `checkedAt` |

Notas:

- Indexa **varios ejemplos por indicador** en el lenguaje de la gente
  ("cuido la bodega", "le cobro a los clientes") y no solo definiciones
  técnicas. Lo que se compara es el habla cotidiana de la persona.
- No indexes los relatos de las personas en la base de conocimiento
  compartida. Son datos personales y en modo `mock` nunca salen del
  navegador. Si el backend los guarda para la evaluación, debe ser con
  consentimiento y anonimizados (decisión pendiente).

## Esquema de almacenamiento

```sql
CREATE TABLE embedding (
  collection TEXT NOT NULL,       -- kb_indicator | kb_competency | …
  ref_id TEXT NOT NULL,           -- id en la base de conocimiento
  chunk INTEGER DEFAULT 0,
  text TEXT NOT NULL,             -- el texto EXACTO que se embebió
  text_hash TEXT NOT NULL,        -- para re-embeber solo lo que cambió
  model TEXT NOT NULL,            -- p. ej. 'GTE_LARGE_FP16'
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,           -- normalizado L2
  created_at TEXT NOT NULL,
  PRIMARY KEY (collection, ref_id, chunk, model)
);
```

- Guarda `model` y `dim`. Si cambia el modelo, re‑embebe todo y no mezcles
  vectores de modelos distintos.
- **Normaliza con L2** antes de guardar y antes de consultar. Así el
  producto punto equivale al coseno, que es lo que TurboVec necesita.
- Con el volumen de KALLPA (cientos de vectores), una búsqueda exhaustiva en
  memoria es suficiente y exacta. Usa TurboVec o un índice ANN solo cuando
  midas que hace falta.

## Flujo de ingesta (script del backend)

1. Carga y valida la base de conocimiento (`knowledge-model.md` §7).
2. Para cada unidad, arma el texto, calcula su hash y omite las que no
   cambiaron.
3. Ejecuta `embed({ modelId, text: lote })` por lotes y normaliza.
4. Guarda en `embedding` (en una transacción).
5. Si usas TurboVec: `createVectorIndex({ dim })`, luego `index.add({ ids, vectors })`
   y `index.write({ path })`. Al arrancar, usa `loadVectorIndex({ path })`. Los
   ids deben mapear a `collection:ref_id:chunk`.

## Flujo de consulta (en el diagnóstico)

1. Divide el texto de la persona en fragmentos (frases). Ya existe
   `splitFragments` en `src/services/engine/text.js` como referencia.
2. Embebe cada fragmento y normalízalo.
3. Busca el top‑K en `kb_indicator` (K = 5–8), **filtrando** por
   `validation` permitida y, si aplica, por las familias de las ocupaciones
   mencionadas. El filtro solo prioriza; no debe excluir competencias
   transferibles.
4. Agrupa por `competencyId` y quédate con la mejor puntuación y el fragmento
   que la produjo. Ese fragmento es la candidata a cita.
5. Aplica un **umbral calibrado** (no inventado): por debajo de `τ_low` se
   descarta y entre `τ_low` y `τ_high` el candidato queda "dudoso". Los
   umbrales se fijan con el conjunto de referencia (`evaluation.md`) para
   cada modelo de embeddings.
6. Entrega los candidatos (competencia, fragmento, puntuación, indicador
   coincidente) a la clasificación. **No escribas nada en el perfil en este
   paso.**

## RAG para respuestas y explicaciones

Usa RAG cuando el modelo generativo deba **explicar** algo con base en la
base de conocimiento. Por ejemplo: por qué una ocupación es cercana, qué
practicar para una brecha o qué significa una competencia.

- El contexto que recibe `completion()` es una lista numerada de fragmentos
  recuperados, cada uno con `id`, `validation` y texto.
- Instrucción del sistema: responder **solo** con esa información, citar los
  ids usados y responder "no tengo información suficiente" si los fragmentos
  no cubren la pregunta.
- El backend comprueba que los ids citados existan en el contexto entregado.
  Si no hay citas válidas, usa el mensaje de limitación.
- Si la recuperación no supera el umbral, **no llames al LLM** para
  "rellenar": aplica la regla de "sin fuentes relevantes" de
  `classification-rules.md`.

## Evaluar la relevancia

Antes de usar la recuperación en el diagnóstico, mide con el conjunto de
referencia (`evaluation.md` §3): Recall@K por competencia, MRR y la
distribución de puntuaciones de positivos frente a negativos. Si los
positivos y los negativos se solapan mucho, el modelo de embeddings no sirve
para español coloquial. En ese caso, cambia de modelo o añade ejemplos al
indicador antes de bajar el umbral.
