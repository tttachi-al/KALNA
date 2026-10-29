/**
 * Backend de KALLPA: expone la API del contrato de qvacAdapter.js y usa
 * QVAC (@qvac/sdk) para la entrevista adaptativa del diagnóstico.
 *
 *   npm run server
 *
 * Variables (opcionales, en .env o en el entorno):
 *   KALLPA_PORT          puerto HTTP (8000; si falta, PORT, que asigna Render)
 *   KALLPA_HOST          interfaz (127.0.0.1)
 *   KALLPA_CORS_ORIGIN   origen del frontend (http://localhost:5173)
 *   KALLPA_LLM_MODEL     constante de modelo del SDK (QWEN3_4B_INST_Q4_K_M)
 *   KALLPA_LLM_CTX       contexto en tokens (8192)
 *   KALLPA_LLM_TIMEOUT_MS tiempo máximo por generación (60000)
 *   DATABASE_URL         PostgreSQL: perfiles y competencias (nunca transcripciones)
 *   KALLPA_EMBED_MODEL   constante del modelo de embeddings (EMBEDDINGGEMMA_300M_Q8_0)
 */
import { createServer } from 'node:http';
import { CookieResponse, createApp, HttpError } from './app.js';
import { syncCatalog } from './db/catalog.js';
import { migrate } from './db/migrate.js';
import { createProfileStore } from './db/profiles.js';
import { createEmbeddingIndexer } from './embeddings/indexer.js';
import { createRecommender } from './matching/recommend.js';
import { createRouteService } from './route/service.js';
import { createPassportService } from './passport/service.js';
import { createCvService } from './cv/service.js';
import { createCvStore } from './cv/draft.js';
import { createAssessmentService } from './assessment/service.js';
import { createAuthService } from './auth/service.js';
import { createAssessmentDbStore, createAssessmentMemoryStore } from './assessment/store.js';
import { createSemanticIndex } from './matching/semantic.js';
import { createQvacEmbedder } from './qvac/embeddings.js';
import { createPool, describeUrl } from './db/pool.js';
import { createQvacLlm } from './qvac/llm.js';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 17)) {
  console.error(`QVAC requiere Node.js 22.17 o superior. Versión actual: ${process.versions.node}.`);
  process.exit(1);
}

const env = process.env;
const PORT = Number(env.KALLPA_PORT || env.PORT) || 8000; // PORT: la asigna Render
const HOST = env.KALLPA_HOST || '127.0.0.1';
const ORIGIN = env.KALLPA_CORS_ORIGIN || 'http://localhost:5173';
const BASE = '/api';
const MAX_BODY = 256 * 1024;

const log = (msg) => console.log(`[kallpa] ${new Date().toISOString()} ${msg}`);

const llm = createQvacLlm({
  modelName: env.KALLPA_LLM_MODEL || 'QWEN3_4B_INST_Q4_K_M',
  ctxSize: Number(env.KALLPA_LLM_CTX) || 8192,
  timeoutMs: Number(env.KALLPA_LLM_TIMEOUT_MS) || 60000,
  log,
});
const pool = createPool(env.DATABASE_URL);
const embedder = createQvacEmbedder({ modelName: env.KALLPA_EMBED_MODEL || 'EMBEDDINGGEMMA_300M_Q8_0', log });
const profiles = pool ? createProfileStore(pool) : null;
const embeddings = pool ? createEmbeddingIndexer({ pool, embedder, profiles, log }) : null;
const recommender = pool ? createRecommender({ pool, semantic: createSemanticIndex({ pool, embedder }) }) : null;
const routes = pool ? createRouteService({ pool, recommender, llm, log }) : null;
const passports = pool ? createPassportService({ pool, recommender, llm, embedder, loadDestination: routes.loadDestination }) : null;
const cvs = createCvService({ llm, passports, store: pool ? createCvStore(pool) : null });
const assessments = createAssessmentService({ llm, store: pool ? createAssessmentDbStore(pool) : createAssessmentMemoryStore(), log });
const auth = pool ? createAuthService({ pool, log }) : null;
// KALLPA_SECURE_COOKIES=1 cuando la API se sirve por HTTPS (añade Secure a la cookie de sesión).
const handle = createApp({ llm, db: pool, profiles, embeddings, embedder, recommender, routes, passports, cvs, assessments, auth, secureCookies: env.KALLPA_SECURE_COOKIES === '1', log });

/** Cookies de la petición como objeto { nombre: valor }. */
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function send(res, status, payload) {
  if (payload instanceof CookieResponse) {
    res.setHeader('Set-Cookie', payload.cookies);
    res.setHeader('Cache-Control', 'no-store');
    payload = payload.body;
  }
  if (status === 200 && Buffer.isBuffer(payload?.buffer)) {
    res.writeHead(200, { 'Content-Type': payload.contentType, 'Content-Disposition': `attachment; filename="${payload.filename}"`, 'Content-Length': payload.buffer.length,
      'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Expose-Headers': 'Content-Disposition', 'Cache-Control': 'no-store', Vary: 'Origin' });
    res.end(payload.buffer);
    return;
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'La solicitud es demasiado grande.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'El cuerpo no es JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (!url.pathname.startsWith(BASE)) return send(res, 404, { error: 'Ruta no encontrada.' });
  try {
    const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : null;
    const out = await handle(req.method, url.pathname.slice(BASE.length) || '/', body, url.searchParams, { cookies: parseCookies(req.headers.cookie) });
    send(res, 200, out);
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { error: error.message, ...error.extra });
    // No se registra el contenido de la conversación, solo el error.
    log(`Error en ${req.method} ${url.pathname}: ${error?.stack || error}`);
    send(res, 500, { error: 'Ocurrió un error en el servidor de KALLPA.', retryable: true });
  }
});

server.listen(PORT, HOST, () => {
  log(`API en http://${HOST}:${PORT}${BASE} (CORS: ${ORIGIN})`);
  const dbReady = !pool
    ? (log('Sin DATABASE_URL: no se aplican migraciones de PostgreSQL.'), Promise.resolve(false))
    : migrate(pool, { log })
        .then(() => syncCatalog(pool))
        .then((c) => (log(`PostgreSQL listo (${describeUrl(env.DATABASE_URL)}) · catálogo: ${c.competencies} competencias`), true))
        .catch((e) => (log(`PostgreSQL no disponible (${describeUrl(env.DATABASE_URL)}): ${e.message}. El chat sigue funcionando.`), false));
  // Precarga del modelo al arrancar: la primera vez lo descarga del registro de QVAC.
  const llmReady = llm.load().catch(() => log('El diagnóstico responderá 503 hasta que el modelo cargue. Revisa el error de arriba.'));
  // Embeddings después del LLM (para no competir en la carga) y en segundo plano:
  // catálogo y perfiles pendientes. Un fallo aquí no afecta a la conversación.
  Promise.all([dbReady, llmReady]).then(async ([db]) => {
    try {
      await embedder.load();
      if (!db || !embeddings) return;
      const c = await embeddings.indexCatalog();
      log(`Embeddings del catálogo: ${c.embedded} generados, ${c.unchanged} sin cambios`);
      const o = await embeddings.indexOccupations();
      log(`Embeddings de empleos (${o.occupations}): ${o.embedded} generados, ${o.unchanged} sin cambios`);
      const retried = await embeddings.retryPending();
      if (retried.length) log(`Embeddings reintentados en ${retried.length} perfil(es)`);
    } catch (e) {
      log(`Embeddings no disponibles por ahora: ${e.message}. Se reintentarán al guardar un perfil.`);
    }
  });
});

async function shutdown() {
  log('Cerrando…');
  server.close();
  await embeddings?.idle().catch(() => {});
  await embedder.close().catch(() => {});
  await llm.close().catch(() => {});
  await pool?.end().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
