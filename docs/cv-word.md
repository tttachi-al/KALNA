# CV editable en Word desde el pasaporte

## Uso

En el pasaporte del puesto seleccionado, «Generar CV en Word» reemplaza a «Copiar presentación» y «Descargar datos». La impresión del pasaporte sigue disponible. La generación muestra un estado de carga, bloquea solicitudes duplicadas desde el botón y descarga únicamente una respuesta DOCX válida; cualquier error queda visible.

El formulario «Completar datos para el CV» y sus enlaces se retiraron por petición del usuario. El CV se descarga directamente desde el pasaporte; los datos que falten se completan en Word. La ruta antigua `/cv` redirige a puestos recomendados. Los datos de CV ya guardados se conservan y pueden seguir utilizándose al generar el documento.

## Backend y validación

- `POST /cv/word`: recibe `profileId` y `occupationId`. Recupera el perfil persistido, el pasaporte existente de ese puesto y el borrador de `profile_cv`. No vuelve a generar el pasaporte ni llama al servicio de rutas. Un borrador aportado en la solicitud se valida y se guarda solo después de generar el archivo correctamente.
- `GET/PUT /profile/:id/cv`: reutiliza el contrato de los adaptadores para cargar o guardar los datos declarados.
- En simulación se envían explícitamente `mode: simulation`, el perfil ficticio y su pasaporte. El puesto se resuelve en el catálogo del servidor y no se persiste ese perfil ni el CV simulado. La descarga se identifica con `CV_SIMULACION_...docx`.
- `server/cv/content.js` usa el cliente QVAC existente, Qwen y salida JSON estructurada. Una llamada redacta y organiza funciones y perfil; otra comprueba cada párrafo contra sus fuentes. Se limitan longitud y contexto. No se envían al modelo los datos de contacto ni se le pide que genere empleadores, cargos, periodos, instituciones o certificaciones.
- La validación comprueba referencias a fuentes, pertenencia a la experiencia, cifras, acreditaciones, niveles, duplicados y competencias confirmadas. Un relato no se convierte automáticamente en un logro: los resultados en esa categoría provienen de campos declarados por la persona. Las habilidades inferidas se conservan como pendientes de validación y no se incluyen como competencias confirmadas.
- Los errores de inferencia, JSON, verificación o construcción del Word interrumpen la descarga. No hay sustitución por un CV ficticio.
- `server/cv/draft.js` valida los datos personales y académicos declarados; `template.js` los introduce directamente en el documento sin intermediación del modelo.

## Plantilla

`server/cv/template.js` define la plantilla independientemente de QVAC. Usa `docx` 9.15, A4, Calibri 11, márgenes de 19 mm, títulos negros, listas nativas y lectura lineal. No usa tablas, columnas, cuadros de texto o gráficos. Todos los campos son texto Word editable. El documento contiene únicamente el CV.

Orden: contacto, perfil profesional, experiencia, competencias, formación académica, formación complementaria y certificaciones, idiomas y datos adicionales cuando existan. Los campos esenciales desconocidos y los apartados de cursos e idiomas tienen indicaciones discretas editables. Los estudios no se completan a partir del nivel que exija el puesto.

Las referencias visuales aportadas se usan exclusivamente para estructura y presentación, no para atribuir sus datos o logros a los usuarios.

El servidor entrega el archivo con MIME Word, `Content-Disposition: attachment`, nombre sanitizado, `Cache-Control: no-store` y CORS para exponer el nombre de descarga. El frontend valida tipo MIME y firma ZIP antes de iniciar la descarga.

## Verificación

- `node --test tests/cv.test.js`: personas con experiencia y estudios, experiencia informal, datos incompletos, inicio con solo estudios, campos editables, contenido no respaldado, fallos de QVAC, XML sin tablas y eliminación de los botones anteriores.
- `$env:KALLPA_CV_HTTP='1'; node --env-file-if-exists=.env --test --test-timeout=240000 tests/cv.http.test.js`: con el backend activo, genera y descarga un DOCX mediante QVAC y PostgreSQL reales; también comprueba el modo simulación. Crea y elimina exclusivamente su perfil de prueba.
- `node server/cv/qa.js`: genera una plantilla vacía y un ejemplo determinista en `tmp/cv-qa`, sin QVAC, para revisión manual opcional.

La revisión visual y la prueba manual de edición en Word quedan a cargo del usuario, según su indicación. El XML y las descargas reales se validan automáticamente.
