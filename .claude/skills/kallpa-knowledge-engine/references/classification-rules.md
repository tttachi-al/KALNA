# Clasificación de competencias y reglas condicionales del agente

## Contenido

1. Dónde encaja en el flujo actual
2. Pipeline de clasificación
3. Formato de salida
4. Validaciones del backend (después del modelo)
5. Paso de estados del perfil
6. Reglas condicionales del agente
7. Prompts del modelo (separados de las reglas)
8. Fallos y degradación

---

## 1. Dónde encaja

El diagnóstico es una máquina de etapas en `src/services/engine/diagnosisFlow.js`:
`bienvenida → nombre → ocupaciones → formalidad → tiempo → tareas →
herramientas → responsabilidades → situaciones → (ampliar) → evidencia → fin`.

La clasificación sustituye **solo** a `extractCompetencies(text)`
(`engine/extractor.js`, basada en regex) y a la evaluación de ejemplos
`evaluateEvidence` / `evidenceMismatch` (`engine/evidence.js`, `engine/profile.js`).
La máquina de etapas, los mensajes de la UI (`StageUI`) y el formato del
perfil se mantienen. El backend devuelve `{ session, messages, ui }` igual
que `mockAdapter`.

Comportamientos del motor actual que el backend debe conservar:

- Nombrar la ocupación no genera competencias (`maskOccupationWords`).
- Si en `tareas` no aparece nada, se pide más detalle **una vez** (`retries.tareas`).
- Si al final no hay ninguna competencia, se pasa una vez por `ampliar`.
- Se piden ejemplos para un máximo de `MAX_EVIDENCE_QUESTIONS = 4`
  competencias (`prioritizeForEvidence`).
- Una mención en `herramientas` queda `por_validar`; en las demás etapas,
  `declarada`. Nunca se baja un estado.
- Las competencias descartadas (`dismissed`) no se vuelven a proponer.
- Las ocupaciones fuera de alcance reciben el mensaje de alcance (`kind: 'scope'`).

## 2. Pipeline de clasificación

```
texto de la persona (+ etapa, + ocupaciones declaradas)
  │
  ├─ 1. Normalizar y dividir en fragmentos
  ├─ 2. Recuperar candidatos (retrieval.md): competencia, fragmento, puntuación
  ├─ 3. Clasificar con el LLM: elegir SOLO entre los candidatos y el catálogo,
  │     con una cita literal por cada competencia
  ├─ 4. Validar en código (§4) → descartar lo que no cumpla
  ├─ 5. Compuerta de suficiencia (opcional, decide(); evaluado y no adoptado, ver docs/decisions-evaluacion.md)
  └─ 6. Reglas del agente (§6) → acción + actualización del perfil + mensaje
```

Por qué así: la recuperación acota el espacio y hace que el resultado sea
explicable. El LLM aporta la lectura del contexto. El código garantiza que
nada salga del catálogo ni carezca de cita.

Para la salida estructurada, usa una herramienta con
`tool_choice: "required"` (verificado para `completion()`) o `responseFormat`
en `batchCompletion()`. Consulta `qvac-integration.md` §4.3 y su lista "por
verificar" antes de elegir.

## 3. Formato de salida

Esquema que debe devolver el paso 3 (JSON Schema de los `parameters` de la
herramienta):

```json
{
  "type": "object",
  "properties": {
    "competencies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "enum": ["<ids del catálogo, inyectados al construir el esquema>"] },
          "quote": { "type": "string", "description": "Fragmento LITERAL del texto de la persona" },
          "reason": { "type": "string", "description": "Por qué el fragmento muestra la competencia, en una frase" },
          "strength": { "type": "string", "enum": ["clara", "dudosa"] }
        },
        "required": ["id", "quote", "reason", "strength"]
      }
    },
    "needsClarification": { "type": "boolean" },
    "clarificationQuestion": { "type": ["string", "null"] },
    "outOfScope": { "type": "boolean" }
  },
  "required": ["competencies", "needsClarification", "outOfScope"]
}
```

Resultado interno del backend, después de validar:

```json
{
  "found": [
    {
      "id": "control_suministros",
      "quote": "cada lunes reviso el depósito y anoto lo que falta",
      "reason": "Revisa existencias con frecuencia fija y registra faltantes.",
      "strength": "clara",
      "retrievalScore": 0.71,
      "indicatorId": "cs_revision_periodica",
      "source": "tareas"
    }
  ],
  "rejected": [{ "id": "atencion_cliente", "why": "quote_not_in_text" }],
  "action": "propose",
  "clarification": null
}
```

`found[].quote` y `source` se convierten en `mentions[{ quote, source }]`
del perfil. `reason` alimenta el mensaje que explica la propuesta.

## 4. Validaciones del backend

Descarta una propuesta del modelo si:

1. `id` no existe en el catálogo activo, o está en `profile.dismissed`.
2. `quote` no aparece en el texto de entrada. Compáralo después de
   normalizar (minúsculas, sin tildes, espacios colapsados), igual que
   `normalize()` en `engine/text.js`.
3. La cita solo contiene el nombre de una ocupación ("trabajé de cajera").
4. La competencia no estaba entre los candidatos recuperados **y** el modelo
   marcó `strength: 'dudosa'`.
5. La misma cita se usa para más de 3 competencias. Es señal de
   sobreinterpretación: quédate con las de mayor puntuación de recuperación.

Registra cada descarte con su motivo para la evaluación.

## 5. Paso de estados del perfil

| Situación | Estado resultante | Quién decide |
| --- | --- | --- |
| Mencionada en `herramientas` (solo indicio) | `por_validar` | Regla |
| Mencionada en tareas, responsabilidades o situaciones con `strength: 'clara'` | `declarada` | Regla, a partir de la salida validada |
| `strength: 'dudosa'` | No se agrega; genera una pregunta de aclaración o queda como candidato en la sesión | Regla |
| Ejemplo aportado en `evidencia` y evaluado `fuerte`, sin desajuste | `evidencia` | Regla, usando la evaluación del ejemplo |
| Ejemplo `parcial` | No sube (salvo `por_validar` → `declarada`, como hoy) | Regla |
| La persona descarta | `dismissed` | Persona |

Evaluar un ejemplo (para reemplazar `evaluateEvidence` y `evidenceMismatch`)
devuelve `{ level: 'fuerte'|'parcial'|'insuficiente', mismatch: competencyId|null }`.
Criterios para `fuerte`: describe **qué hizo** y además al menos una de
estas cosas: frecuencia o momento, pasos, cantidad, motivo o resultado. Y
habla de la competencia preguntada. Con `decide()` se puede implementar como
dos preguntas `noul` (concreto / habla de la competencia), con umbrales
calibrados.

**El modelo no asigna estados.** Entrega evidencia estructurada y las
reglas deciden. Así se cumple "no presentar competencias inferidas como
demostradas".

**Confirmación explícita.** Hoy la persona puede descartar, pero no
"confirmar". Si se quiere registrar la confirmación, añade un campo opcional
(`confirmedAt`) a `Competency` sin cambiar `status`. Es un cambio de
contrato y hay que acordarlo antes.

## 6. Reglas condicionales del agente

Se evalúan en orden; gana la primera que aplica. Son código del backend, con
pruebas unitarias. No son instrucciones al modelo.

| # | Condición | Acción | Mensaje (redactado por plantilla o LLM acotado) |
| --- | --- | --- | --- |
| R1 | El texto menciona solo ocupaciones fuera de alcance | `scope_notice` | Explica el alcance (5 ocupaciones) e invita a elegir tareas parecidas |
| R2 | Texto vacío, o solo la ocupación ("trabajé de reponedor") | `ask_detail` | Pide qué hacía, con qué materiales o con quién |
| R3 | `needsClarification` o solo hay candidatos `dudosa` | `ask_clarification` (máx. 1 por etapa) | Una pregunta concreta, que no sugiera la respuesta |
| R4 | Hay propuestas válidas | `propose` | Lista las competencias **con la cita** y explica que son potenciales hasta dar un ejemplo |
| R5 | Etapa `evidencia`, ejemplo `fuerte` y sin desajuste | `update_profile` → `evidencia` | Confirma y nombra el cambio a «Con evidencia» |
| R6 | Etapa `evidencia`, ejemplo `parcial` o `insuficiente` | `keep_status` | Indica qué detalles faltan (`EVIDENCE_TIPS`) |
| R7 | Ejemplo habla de otra competencia (`mismatch`) | `keep_status` + `propose` de la otra | Explica el desajuste |
| R8 | La persona confirma o descarta | `update_profile` | Acusa recibo |
| R9 | Se pide comparar ocupaciones o la ruta y el perfil no tiene ninguna competencia activa | `ask_more_info` | Invita a completar el diagnóstico; no recomienda |
| R10 | La recuperación o la base de conocimiento no tienen nada relevante sobre lo pedido | `no_sources` | Dice que no tiene información suficiente; no inventa |
| R11 | Se pide demanda laboral, sueldos o vacantes concretas sin datos | `no_sources` | Remite a Empleos Perú; `getRegionalDemand` sigue con `available: false` |
| R12 | Error o tiempo de espera de QVAC | `fallback` | Usa el motor de reglas local para esa respuesta y regístralo |

Límites que protegen la conversación: como máximo **una** pregunta de
aclaración por etapa (igual que los `retries` actuales) y nunca más de una
pregunta en el mismo mensaje.

## 7. Prompts del modelo

Guarda los prompts como plantillas versionadas (por ejemplo,
`server/prompts/classify.v1.md`), no incrustados en la lógica. Deben
contener solo el **cómo leer el texto**; las decisiones las toman las reglas.

Esqueleto del prompt de clasificación (system):

```
Eres un asistente que identifica competencias laborales en relatos de trabajo en español del Perú.
Solo puedes elegir competencias de esta lista (id: nombre — indicadores):
{catálogo filtrado: candidatos recuperados primero, luego el resto de la familia}

Reglas de lectura:
- Cada competencia debe apoyarse en un fragmento LITERAL del texto (campo quote).
- Nombrar una ocupación o un lugar de trabajo no es una competencia.
- Si el texto es vago, marca needsClarification y propone UNA pregunta concreta y neutral.
- Si no hay ninguna competencia clara, devuelve la lista vacía. Es una respuesta válida.
- No evalúes si la persona es buena o mala en algo.
Texto de la persona (etapa: {stage}):
"""{text}"""
```

Para la redacción de mensajes, pasa la acción decidida, los datos y el tono
(tú, frases cortas, sin tecnicismos). Pide que no se añadan hechos que no
estén en los datos. Si la redacción con LLM falla o no pasa las
validaciones de longitud y contenido, usa las plantillas actuales de
`diagnosisFlow.js`.

## 8. Fallos y degradación

- Timeout por llamada (por ejemplo, 8 s en el diagnóstico). Si se supera, se
  cancela con `cancel({ requestId })` y se aplica la regla R12.
- Si la salida no valida contra el esquema, se reintenta una vez y después
  se aplica R12.
- Registra en cada respuesta: `engine: 'qvac'|'rules'`, versión del prompt,
  modelo, tiempo y descartes. Sirve para auditoría y para la evaluación.
