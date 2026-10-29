# Evaluación de competencias y constancia de KALLPA

## Uso

En «Mi perfil», pestaña «Con evidencia», al final de las tarjetas aparece «Validar competencias» («Responde situaciones laborales y obtén tu constancia de evaluación»). Lleva a `/evaluacion`:

1. Inicio: competencias con evidencia (se pueden desmarcar), número de preguntas y criterio de aprobación.
2. Preparación en segundo plano con progreso por competencia (la interfaz consulta cada 2,5 s).
3. Una pregunta por pantalla: número y total, competencia, origen (QVAC o banco), situación, cinco alternativas, barra de progreso, «Anterior» y «Siguiente» (requiere elegir una alternativa).
4. Revisión de respuestas con «Cambiar respuesta».
5. Resultados por competencia con retroalimentación y, solo para las aprobadas, «Obtener constancia». Con dos o más aprobadas, también «Obtener constancia consolidada».

El intento se recupera al recargar la pestaña (sessionStorage guarda el identificador y las respuestas aún no enviadas).

## Reglas

- Se evalúan solo las competencias con estado `evidencia` y no descartadas (`evidenceCompetencyIds`).
- Dos preguntas por competencia. Una competencia se aprueba en el intento solo si ambas respuestas son correctas (`summarizeAssessment`, compartido por backend e interfaz; la interfaz recalcula el resumen y, si no coincide con el del backend, no muestra constancias).
- Los resultados no afirman dominio integral: «Aprobada en esta evaluación» / «Por reforzar según esta evaluación».

## Preguntas

- **QVAC** (`server/assessment/generate.js`) redacta dos situaciones por competencia con salida JSON con esquema, usando las evidencias de la persona y preguntas del banco como referencia. Hasta cuatro rondas; desde la segunda, sin referencias (el modelo tendía a copiarlas).
- **Validación por código**: cinco alternativas distintas, una clave, longitudes, sin «todas las anteriores», explicación sin citar posiciones, sin copiar situación ni alternativas del banco.
- **Verificación independiente con QVAC**: resuelve cada pregunta sin la clave, dos veces con las alternativas en distinto orden. Se publica solo si ambas pasadas eligen la clave, ninguna otra alternativa es aceptable y la situación mide la competencia.
- **Respaldo**: preguntas del banco validado para esa competencia. Si no se reúnen dos preguntas, la competencia queda como no evaluable en ese intento; no se inventan preguntas.
- Publicación automática tras esta validación, por decisión del equipo. Con QWEN3_4B_INST_Q4_K_M, en pruebas reales la mayoría de las preguntas generadas se rechazan por ambiguas y una pregunta incorrecta llegó a pasar ambas verificaciones. Alternativas documentadas: revisión humana antes de publicar o un modelo mayor (`KALLPA_LLM_MODEL=QWEN3_8B_INST_Q4_K_M`).

### Banco validado

- Material original: `server/assessment/source/banco-preguntas-kallpa.txt` (20 preguntas, cinco perfiles).
- `npm run assessment:import` genera `server/assessment/bank.json`. La clave sale del marcador `[CORRECTA]`; la prueba vuelve a analizar el material y exige que coincida.
- `server/assessment/annotations.js`: competencia principal de cada pregunta y explicación breve (redactada por KALLPA a partir de la alternativa correcta). La asignación es una propuesta pendiente de revisión experta. Observaciones: la pregunta 16 (Vendedor) mide protocolos; «Uso de herramientas digitales» de Vendedor no tiene una pregunta que la mida directamente.
- Cobertura con dos o más preguntas: Cumplimiento de protocolos, Comunicación, Uso de herramientas digitales. Las demás competencias dependen de QVAC.

## Backend y seguridad

- `POST /assessments` (`{ profileId }` o, sin perfil guardado, `{ profile }`, que marca el intento como simulación) · `GET /assessments/:id` · `POST /assessments/:id/submit` · `POST /assessments/:id/certificate` (`{ competencyId? , participantName?, participantNameConfirmed? }`).
- La clave nunca sale del backend antes de corregir. Alternativas barajadas por intento con identificadores opacos (en el material, la D es correcta en 10 de 20 preguntas). La corrección y la decisión de habilitar la constancia son del backend (403 para competencias no aprobadas, 409 antes de terminar).
- Persistencia: tabla `competency_assessments` (migración 012) con preguntas, claves, respuestas y resultados. Sin base de datos, memoria del servidor hasta 24 h (la interfaz lo avisa). El nombre del participante no se guarda: solo se usa al generar el PDF y requiere confirmación.

## Constancia

PDF A4 con `pdfkit` (`server/assessment/certificate.js`): título «Constancia de Evaluación de Competencias — KALLPA», participante (o «No indicado»), puesto o contexto laboral, fecha, identificador `KALLPA-EV-…`, competencia(s) aprobada(s), origen de las preguntas, criterio y la leyenda de documento informativo no oficial. En modo demostración lo indica.

## Verificación

- `node --test tests/assessment.test.js`: banco idéntico al material, solo competencias con evidencia, sin clave en la vista, verificación y respaldo, carencias sin inventar, aprobación 2/2 frente a 1/2, barajado, constancias individual y consolidada (texto extraído del PDF), errores HTTP y presencia condicional de los botones.
- Prueba real (29/10/2026) con QVAC y PostgreSQL en un backend aparte: perfil guardado y perfil de demostración, flujo completo en el navegador, error de descarga con reintento y 403 para una competencia no aprobada.
