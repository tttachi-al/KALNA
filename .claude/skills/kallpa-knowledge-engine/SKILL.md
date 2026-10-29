---
name: kallpa-knowledge-engine
description: Guía técnica para implementar y mantener el motor de conocimiento e IA de KALLPA (plataforma de empleabilidad, React + Vite) con QVAC (@qvac/sdk / @qvac/cli). Úsala SIEMPRE que la tarea toque QVAC, el adaptador qvacAdapter.js o el backend de KALLPA, embeddings, búsqueda semántica, RAG, índices vectoriales, la base de conocimiento laboral (competencias, ocupaciones, evidencias, recursos), el knowledge graph, la clasificación o extracción de competencias a partir de lo que cuenta la persona, la lógica condicional del agente de diagnóstico (qué preguntar, cuándo pedir aclaración, cuándo proponer o actualizar el perfil), el uso de LLM/decide()/salida estructurada, o la evaluación de calidad de estas piezas, aunque el usuario no nombre QVAC explícitamente (por ejemplo "conectar la IA", "que el chatbot entienda mejor", "recomendar ocupaciones con fundamento").
---

# KALLPA · Motor de conocimiento (QVAC)

KALLPA ayuda a personas con experiencia formal e informal a reconocer sus
competencias laborales y a convertirlas en perfil, puestos y ruta. Hoy todo
funciona con un **motor de reglas local** (modo `mock`); la integración con
QVAC **todavía no existe**: solo están el contrato y el adaptador HTTP vacío
en el frontend. Esta skill guía cómo construir esa integración sin romper lo
que ya funciona.

Nada de esto está implementado. No digas que QVAC, el knowledge graph, el
índice vectorial o la base de datos están integrados mientras no exista
código y pruebas que lo demuestren.

## Antes de escribir código

1. **Lee la arquitectura real** (es pequeña y cambia):
   - `src/services/kallpaService.js`: punto único de datos de la UI.
   - `src/services/adapters/qvacAdapter.js`: contrato y endpoints esperados.
   - `src/services/adapters/mockAdapter.js` y `src/services/engine/*`: el
     comportamiento de referencia que el backend debe igualar.
   - `src/data/competencies.js`, `occupations.js`, `jobs.js`, `resources.js`:
     catálogos actuales.
   - `README.md` (sección "Cómo conectar el backend y QVAC") y `tests/engine.test.js`.
2. **Verifica QVAC en la documentación oficial**, no de memoria:
   https://docs.qvac.tether.io/ (cómo elegir la versión del texto completo
   para agentes: https://docs.qvac.tether.io/resources/docs-for-ai-agents/).
   Comprueba la versión instalada
   (`npm ls @qvac/sdk`) y lee la página de la capacidad que vas a usar y su
   entrada en `/sdk/reference/api`. Si una función, un parámetro o un modelo
   no aparece en la documentación de esa versión, **no lo uses**: márcalo
   como "por verificar" y pregunta.
3. Lee la referencia que corresponda a la tarea (tabla abajo).

## Restricciones de arquitectura (no negociables)

- **QVAC no corre en el navegador.** El SDK funciona en Node.js (≥ 22.17),
  Bare y Expo. La app Vite solo habla HTTP con un **backend de KALLPA**, que
  es quien usa QVAC. El navegador nunca carga modelos ni guarda credenciales.
- **El contrato del frontend manda.** El backend implementa los endpoints de
  `qvacAdapter.js` y devuelve exactamente las formas `Session`, `Message`,
  `StageUI`, `Profile`, `Competency`, `Comparison`, `Route`. Si un cambio
  exige tocar el contrato, propónlo primero; no cambies pantallas de React
  para acomodar al backend.
- **El modo `mock` y el modo demostración siguen funcionando** sin backend.
- **Alcance**: cinco ocupaciones de referencia (`limpieza`, `administrativo`,
  `reponedor`, `vendedor`, `cajero`) más los puestos de `jobs.js`; solo
  competencias del catálogo. Nada de vacantes, cursos ni datos de demanda
  inventados.
- **QVAC no trae conocimiento laboral.** Proporciona modelos genéricos
  (LLM, embeddings y decisiones). El conocimiento sobre competencias y
  ocupaciones lo pone KALLPA, con fuente y trazabilidad.

## Separación de responsabilidades

Cada pieza tiene un solo trabajo. No mezcles estas responsabilidades:

| Pieza | Qué hace | Tecnología |
| --- | --- | --- |
| Base de conocimiento | Fuente de verdad versionada (competencias, ocupaciones, evidencias, recursos, fuentes) | Archivos de datos + base relacional |
| Knowledge graph | Relaciones entre entidades (requiere, es base de, respalda…) | Tablas de aristas en base relacional |
| Embeddings | Convertir texto en vectores | `embed()` de QVAC |
| Recuperación | Encontrar candidatos relevantes (top‑K) | Índice vectorial + filtros por metadatos |
| Clasificación | Decidir qué competencias del catálogo aparecen y con qué cita | LLM con salida estructurada y/o `decide()`, validado por código |
| Reglas del agente | Decidir la siguiente acción (preguntar, proponer, actualizar, avisar) | Código determinista en el backend |
| Redacción | Escribir el mensaje para la persona | LLM con `completion()`, acotado por las reglas |

Las **reglas de negocio viven en código** y se prueban; el modelo solo
clasifica o redacta dentro de lo que las reglas permiten.

## Principios de veracidad

- Una competencia inferida es **potencial** hasta que la persona la respalda
  con un ejemplo concreto. Respeta los estados existentes: `por_validar` →
  `declarada` → `evidencia`. El modelo **nunca** asigna `evidencia` solo.
- Toda propuesta lleva **cita textual** de lo que dijo la persona
  (`mentions[].quote`). Si la cita no aparece literalmente en el texto de
  entrada, descarta la propuesta.
- Nombrar una ocupación no implica tener sus competencias.
- Si no hay fuentes o evidencia suficientes, se dice y se pide información;
  no se completa con suposiciones.
- La persona puede confirmar, corregir o descartar (`dismissed`) cualquier
  competencia.

## Flujo de implementación recomendado

Ve por fases; cada una se puede probar sola y no rompe la anterior.

1. **Backend mínimo** que implemente los endpoints reutilizando el motor de
   `src/services/engine` (paridad con `mock`). Mueve `@qvac/sdk` del
   frontend a ese backend.
2. **Base de conocimiento como datos**: extrae los catálogos a archivos con
   esquema, `source` y `validation`; valida al cargar.
3. **Embeddings y recuperación**: indexa definiciones, evidencias de ejemplo
   y señales; mide el recall antes de usarlo en el diagnóstico.
4. **Clasificación con QVAC** detrás de una bandera, comparada con el motor de
   reglas sobre el mismo conjunto de prueba.
5. **Reglas condicionales y redacción con LLM** para las preguntas de
   aclaración y las explicaciones.
6. **Evaluación continua**: el conjunto de referencia y las métricas deben
   pasar antes de activar cada fase.

## Referencias (lee solo la que necesites)

| Archivo | Cuándo leerlo |
| --- | --- |
| `references/qvac-integration.md` | Cualquier uso de QVAC: qué está verificado en la documentación (SDK v0.22 / CLI v0.16), funciones, modelos, límites y lo que falta verificar |
| `references/knowledge-model.md` | Diseñar o modificar la base de conocimiento o el knowledge graph: entidades, relaciones, procedencia, esquema relacional |
| `references/retrieval.md` | Embeddings, índice vectorial, RAG, chunking, umbrales de relevancia |
| `references/classification-rules.md` | Clasificación de competencias, formato de salida, reglas condicionales del agente, prompts |
| `references/evaluation.md` | Métricas, conjunto de referencia, pruebas automáticas y criterios para activar cada fase |

## Al terminar una tarea

- Indica qué partes quedaron **implementadas y probadas**, cuáles son
  **solo diseño** y qué quedó **por verificar** en la documentación de QVAC.
- Ejecuta `npm test` y `npm run lint` (y las pruebas del backend si existen).
  Informa los resultados reales.
- Si añadiste o cambiaste datos de conocimiento, indica su fuente y su
  nivel de validación.
