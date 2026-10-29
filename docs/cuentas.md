# Cuentas: inicio de sesión, registro y eliminación

KALLPA no tenía autenticación: los perfiles eran anónimos (un `profileId` guardado en el navegador). Se añadió un sistema mínimo propio sobre el backend y PostgreSQL existentes, sin dependencias nuevas.

## Interfaz

- Escritorio: «Iniciar sesión» (secundaria, contorno) y «Crear cuenta» (principal, blanca) junto a «Preguntas frecuentes». Con sesión, un solo botón «Mi cuenta».
- Móvil: la barra superior no tiene espacio; los mismos botones encabezan «Más opciones» (menú ☰ y «Más» de la barra inferior).
- Rutas: `/iniciar-sesion` y `/crear-cuenta` (un único formulario, `AuthPage`), `/cuenta` (`AccountPage`). «Eliminar cuenta» solo aparece en «Mi cuenta» con sesión iniciada.
- Estado de la sesión: `AuthProvider` pregunta a `GET /auth/me` al cargar (la cookie es HttpOnly; el navegador no la puede leer).

## Backend (`server/auth/service.js`, migración 013)

- `user_accounts`: correo en minúsculas y hash scrypt con sal. `account_sessions`: SHA-256 del token y caducidad (30 días). `job_profiles.user_id`: dueño del perfil.
- Cookie `kallpa_session`: `HttpOnly; SameSite=Lax; Path=/` (y `Secure` con `KALLPA_SECURE_COOKIES=1` en HTTPS). CORS con `Access-Control-Allow-Credentials` para el origen configurado; el frontend usa `credentials: 'include'`.
- Al crear cuenta o iniciar sesión, el perfil de ese navegador se vincula a la cuenta solo si todavía no tiene dueño.
- Cinco intentos fallidos bloquean el correo 15 minutos (en memoria).
- `DELETE /account` (`{ password, confirmation: 'ELIMINAR' }`): exige sesión válida y la contraseña de nuevo, y solo actúa sobre la cuenta de la sesión. En una transacción borra los perfiles de la cuenta (en cascada: competencias, evidencias, embeddings, rutas, pasaportes, CV y evaluaciones), sus sesiones y la cuenta; luego borra la cookie. Si algo falla, revierte y responde con error; la interfaz solo confirma con `deleted: true`.
- Al eliminar, la interfaz también borra los datos de KALLPA de ese navegador (si no, el perfil local podría volver a guardarse con el mismo identificador).

## Lo que no se elimina

- Constancias PDF ya descargadas: están en el dispositivo de la persona.
- Registros técnicos del servidor (salida estándar): fechas e identificadores truncados de 8 caracteres, sin correo ni respuestas.
- Evaluaciones hechas sin perfil guardado (modo demostración): no están vinculadas a ninguna cuenta.

## Limitaciones conocidas

- No hay recuperación de contraseña ni verificación del correo.
- Iniciar sesión en otro dispositivo no descarga el perfil a ese navegador.
- Los endpoints anteriores que reciben un `profileId` (perfil, pasaporte, CV, evaluación) no exigen sesión, como antes.

## Pruebas

- `node --test tests/accounts.test.js` (en `npm test`): hash, cookies, `/auth/me`, la eliminación usa la cuenta de la sesión, errores sin confirmación falsa, 503 sin base de datos, posición de los botones.
- `npm run test:accounts` (PostgreSQL real): registro, duplicados, vínculo de perfiles sin robar ajenos, contraseña incorrecta no borra nada, una cuenta no afecta a otra, borrado en cascada y sesión invalidada.
