/**
 * Genera (o actualiza) todos los embeddings con QVAC Text Embeddings:
 *
 *   npm run embeddings:index
 *
 * 1. Aplica migraciones y sincroniza el catálogo de competencias.
 * 2. Referencias de las competencias (descripción, indicadores y ejemplos).
 * 3. Empleos sintéticos de PostgreSQL (vector general + uno por tarea).
 * 4. Evidencias de perfiles pendientes o sin vector del modelo actual.
 *
 * Idempotente: una segunda ejecución no genera ni duplica nada si no cambió
 * ningún texto ni el modelo.
 */
import { close as closeQvac } from '@qvac/sdk';
import { syncCatalog } from '../db/catalog.js';
import { migrate } from '../db/migrate.js';
import { createPool } from '../db/pool.js';
import { createProfileStore } from '../db/profiles.js';
import { createQvacEmbedder } from '../qvac/embeddings.js';
import { createEmbeddingIndexer } from './indexer.js';

const pool = createPool(process.env.DATABASE_URL);
if (!pool) {
  console.error('Falta DATABASE_URL. Defínela en .env (ver .env.example).');
  process.exit(1);
}
const embedder = createQvacEmbedder({ modelName: process.env.KALLPA_EMBED_MODEL || 'EMBEDDINGGEMMA_300M_Q8_0', log: (m) => console.log(m) });
try {
  await migrate(pool, { log: (m) => console.log(m) });
  await syncCatalog(pool);
  await embedder.load();
  const d = embedder.describe();
  console.log(`Modelo: ${d.model} · versión ${d.modelVersion}`);
  const indexer = createEmbeddingIndexer({ pool, embedder, profiles: createProfileStore(pool), log: (m) => console.log(m) });
  const c = await indexer.indexCatalog();
  console.log(`Referencias de competencias: ${c.embedded} generadas, ${c.unchanged} sin cambios, ${c.removed} retiradas`);
  const o = await indexer.indexOccupations();
  console.log(`Empleos (${o.occupations}): ${o.embedded} vectores generados, ${o.unchanged} sin cambios, ${o.removed} retirados`);
  const p = await indexer.retryPending();
  console.log(`Perfiles con evidencias indexadas: ${p.length} (${p.filter((r) => r.ok).length} correctos)`);
  console.log(`Dimensión: ${embedder.describe().dim ?? '(sin vectores nuevos en esta ejecución)'}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await embedder.close().catch(() => {});
  await closeQvac().catch(() => {});
  await pool.end();
}
