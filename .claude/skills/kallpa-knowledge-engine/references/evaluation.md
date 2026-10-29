# Calidad y evaluación

Ninguna fase con QVAC se activa por defecto hasta superar estos criterios
**comparada con el motor de reglas actual** sobre el mismo conjunto. Los
umbrales numéricos de abajo son una propuesta inicial que el equipo debe
validar.

## Contenido

1. Conjunto de referencia
2. Métricas
3. Pruebas de recuperación
4. Pruebas de clasificación y evidencias
5. Pruebas de reglas del agente
6. Pruebas de recomendaciones
7. Consistencia
8. Cómo ejecutarlas
9. Criterios para activar cada fase

---

## 1. Conjunto de referencia

Carpeta propuesta: `tests/fixtures/gold/`. Un caso por línea (JSONL):

```json
{
  "id": "g-017",
  "stage": "tareas",
  "occupations": ["limpieza"],
  "text": "cada lunes reviso el depósito y anoto lo que falta, y le aviso a la supervisora",
  "expected": [
    { "id": "control_suministros", "quote": "cada lunes reviso el depósito y anoto lo que falta" }
  ],
  "forbidden": ["atencion_cliente"],
  "expectedAction": "propose",
  "notes": "Frecuencia + registro: indicador cs_revision_periodica",
  "labeledBy": "equipo",
  "validation": "revisado"
}
```

Composición mínima recomendada (≥ 150 casos antes de decidir algo):

- Al menos 4 casos positivos por competencia, con lenguaje coloquial,
  errores de tipeo y frases cortas.
- **Negativos**: solo se nombra la ocupación ("fui cajera 3 años"), tareas
  fuera de alcance (construcción, cocina) y textos vacíos o de una palabra.
- **Ambiguos**: textos donde la acción correcta es `ask_clarification`.
- **Evidencias**: pares (competencia preguntada, ejemplo) con `fuerte`,
  `parcial`, `insuficiente` y `mismatch`.
- Experiencia **informal** (bodega familiar, venta ambulante, trabajo del
  hogar remunerado) en proporción parecida a la formal.

Los casos de `tests/engine.test.js` y `src/data/demoCase.js` sirven de semilla.
No uses relatos reales de personas sin consentimiento y sin anonimizar.

Separa un 30 % como **conjunto ciego** que no se mira al ajustar prompts ni
umbrales.

## 2. Métricas

| Aspecto | Métrica | Umbral inicial propuesto |
| --- | --- | --- |
| Clasificación | Precisión y recall por competencia; F1 micro y macro | Precisión ≥ 0,85, y recall ≥ el del motor de reglas |
| Sin fundamento | % de propuestas con `quote` que no está en el texto (antes de la validación) | Reportar. **Después** de la validación: 0 % |
| Correspondencia evidencia–competencia | Exactitud del nivel (`fuerte`/`parcial`/`insuficiente`) y del `mismatch` | ≥ 0,80 |
| Falsos "Con evidencia" | Casos en que el perfil queda en `evidencia` sin un ejemplo `fuerte` etiquetado | **0** |
| Ocupación ≠ competencia | Propuestas en casos "solo ocupación" | **0** |
| Recuperación | Recall@5 y MRR por competencia esperada | Recall@5 ≥ 0,90 |
| Información insuficiente | Exactitud de la acción en casos ambiguos y vacíos (`ask_*`) | ≥ 0,85 |
| Sin fuentes | % de respuestas RAG que citan ids que no estaban en el contexto | 0 % después de la validación |
| Consistencia | Concordancia entre 3 ejecuciones del mismo caso (mismo conjunto de ids) | ≥ 0,90 |
| Latencia | p95 por turno de diagnóstico en el hardware objetivo | Definir con el equipo |

Las métricas con umbral 0 son **bloqueantes**: protegen la promesa central
de KALLPA, que es no afirmar competencias sin respaldo.

## 3. Pruebas de recuperación

- Para cada caso positivo, ¿aparece la competencia esperada en el top‑K de
  `kb_indicator`?
- Histograma de puntuaciones de positivos frente a negativos, para fijar
  `τ_low` y `τ_high` (`retrieval.md`).
- Repite la prueba para cada modelo de embeddings candidato. Es la forma de
  decidir el modelo para español.

## 4. Pruebas de clasificación y evidencias

- Compara `found` con `expected` y `forbidden`.
- Comprueba que **toda** `quote` aparezca en `text` después de normalizar.
- Ejecuta el motor de reglas (`extractCompetencies`, `evaluateEvidence`) y el
  de QVAC sobre los mismos casos. Informa ambos y la diferencia.

## 5. Pruebas de reglas del agente

Son unitarias y deterministas, sin modelo: se alimenta la salida de la
clasificación simulada (fixtures) y se verifica la acción. Cubre cada regla
R1–R12 de `classification-rules.md` §6, más:

- Nunca hay más de una aclaración por etapa.
- `dismissed` nunca reaparece.
- Un estado nunca baja.
- R12 (fallback) produce la misma forma `{ session, messages, ui }`.

## 6. Pruebas de recomendaciones

- `compareOccupations` y `buildRoute` del backend devuelven lo mismo que
  `engine/matcher.js` y `engine/routeBuilder.js` para perfiles fijos
  (paridad), hasta que un cambio de datos documentado lo altere.
- Toda explicación generada menciona solo competencias presentes en el
  perfil o en `requires` de la ocupación.
- Perfil vacío → `ask_more_info`, sin ranking.
- Ninguna salida afirma demanda, sueldo ni vacantes si
  `getRegionalDemand().available` es `false`.

## 7. Consistencia

- Fija la semilla y una temperatura baja en la clasificación. El ejemplo de
  `batchCompletion()` usa `generationParams: { temp: 0, seed: 42 }`; en HTTP
  son `temperature` y `seed`. Confirma en la referencia de la versión
  instalada que `completion()` acepta los mismos campos.
- Ejecuta cada caso 3 veces e informa la concordancia.
- Un mismo texto en `tareas` y en `responsabilidades` debe dar las mismas
  competencias, aunque el estado pueda cambiar según la fuente.

## 8. Cómo ejecutarlas

- Las pruebas deterministas (reglas, validaciones, integridad de la base de
  conocimiento, paridad) van con `node --test`, como `tests/engine.test.js`,
  y deben correr en CI **sin** modelos.
- Las evaluaciones con modelo van en un script aparte (por ejemplo,
  `npm run eval:knowledge`). Ese script carga los modelos con `loadModel()`,
  recorre el conjunto de referencia y escribe un informe
  `reports/eval-<fecha>.json` con las métricas, el modelo, la versión del
  prompt y la versión de la base de conocimiento.
- No hagas que `npm test` dependa de descargar modelos.

## 9. Criterios para activar cada fase

| Fase | Se activa cuando… |
| --- | --- |
| Backend con paridad | Las pruebas de paridad pasan al 100 % |
| Base de conocimiento como datos | Pasan la validación de esquema y de integridad, y la paridad con `src/data` |
| Recuperación | Recall@5 ≥ 0,90 en el conjunto ciego con el modelo elegido |
| Clasificación QVAC | Métricas bloqueantes en 0 y precisión ≥ motor de reglas en el conjunto ciego |
| Redacción con LLM | Revisión humana de ≥ 30 conversaciones sin afirmaciones sin fundamento |

Mantén siempre el interruptor para volver al motor de reglas.
