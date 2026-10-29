import * as qvac from '@qvac/sdk';
import { SDK_VERSION } from './llm.js';

/**
 * Cliente de QVAC Text Embeddings (@qvac/sdk 0.22.0), solo para Node.
 *
 * Funciones usadas (documentadas en la versión instalada):
 *   loadModel({ modelSrc, onProgress })              → modelId
 *   embed({ modelId, text: string | string[] })       → { embedding: number[] | number[][] }
 *   cancel({ requestId }), unloadModel({ modelId, clearStorage: false })
 *
 * Ciclo de vida: el modelo se carga una vez (al arrancar o en la primera
 * petición) y se reutiliza; las peticiones se atienden en cola. `close()` solo
 * descarga ESTE modelo: el worker de QVAC lo cierra el cliente del LLM.
 *
 * Modelo por defecto: EMBEDDINGGEMMA_300M_Q8_0 (google/embeddinggemma-300m,
 * cuantizado Q8_0, 0,31 GiB). Multilingüe (más de 100 idiomas), 768
 * dimensiones (verificado con el modelo real). GTE_LARGE_FP16 se descartó: su
 * ficha indica que solo admite inglés.
 *
 * Cada vector se valida (finito, dimensión coherente) y se normaliza con L2
 * antes de devolverlo, aunque el modelo ya los entregue normalizados.
 */
export class EmbeddingUnavailableError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'EmbeddingUnavailableError';
    this.retryable = true;
  }
}

export class InvalidEmbeddingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEmbeddingError';
  }
}

/** Constante del SDK de un modelo de embeddings; no admite nombres inventados. */
export function resolveEmbeddingModel(name) {
  const entry = qvac[name];
  if (!entry || typeof entry !== 'object' || typeof entry.src !== 'string') {
    throw new Error(`El modelo "${name}" no existe en @qvac/sdk ${SDK_VERSION}.`);
  }
  if (entry.engine !== 'llamacpp-embedding') {
    throw new Error(`"${name}" no es un modelo de embeddings (engine: ${entry.engine}).`);
  }
  return entry;
}

/**
 * Valida y normaliza un lote. Lanza InvalidEmbeddingError si algo no cuadra:
 * así nunca se guarda un vector defectuoso.
 */
export function normalizeBatch(vectors, expectedCount, expectedDim = null) {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) {
    throw new InvalidEmbeddingError(`Se esperaban ${expectedCount} vectores y llegaron ${Array.isArray(vectors) ? vectors.length : 0}.`);
  }
  const dim = expectedDim ?? vectors[0]?.length;
  if (!Number.isInteger(dim) || dim <= 0) throw new InvalidEmbeddingError('El vector está vacío.');
  return vectors.map((v, i) => {
    if (!Array.isArray(v) || v.length !== dim) throw new InvalidEmbeddingError(`El vector ${i} tiene ${v?.length} dimensiones; se esperaban ${dim}.`);
    let sum = 0;
    for (const x of v) {
      if (typeof x !== 'number' || !Number.isFinite(x)) throw new InvalidEmbeddingError(`El vector ${i} contiene un valor no finito.`);
      sum += x * x;
    }
    const norm = Math.sqrt(sum);
    if (!(norm > 0)) throw new InvalidEmbeddingError(`El vector ${i} tiene norma cero.`);
    return v.map((x) => x / norm);
  });
}

/**
 * @param {object} o
 * @param {string} o.modelName  constante del SDK (EMBEDDINGGEMMA_300M_Q8_0)
 * @param {number} o.timeoutMs  tiempo máximo por lote
 * @param {number} o.batchSize  textos por llamada a embed()
 * @param {(msg: string) => void} o.log
 */
export function createQvacEmbedder({ modelName = 'EMBEDDINGGEMMA_300M_Q8_0', timeoutMs = 60000, batchSize = 16, log = () => {} } = {}) {
  let entry = null;
  try {
    entry = resolveEmbeddingModel(modelName);
  } catch (error) {
    log(error.message);
  }
  const info = {
    engine: 'qvac-embeddings',
    sdk: SDK_VERSION,
    model: modelName,
    // Versión exacta de los pesos: suma SHA-256 del archivo en el registro de QVAC.
    modelVersion: entry?.sha256Checksum || null,
    dim: null,
    status: entry ? 'idle' : 'error',
    error: entry ? null : `Modelo de embeddings no válido: ${modelName}`,
    loadedAt: null,
  };
  let modelId = null;
  let loading = null;
  let queue = Promise.resolve();

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const src = resolveEmbeddingModel(modelName);
        info.status = 'loading';
        modelId = await qvac.loadModel({
          modelSrc: src,
          onProgress: (p) => {
            if (p.percentage >= 100) log(`Modelo de embeddings descargado: ${modelName}`);
          },
        });
        info.status = 'ready';
        info.error = null;
        info.loadedAt = new Date().toISOString();
        log(`Embeddings listos: ${modelName} (modelId ${modelId})`);
      } catch (error) {
        info.status = 'error';
        info.error = error?.message || String(error);
        loading = null;
        log(`No se pudo cargar ${modelName}: ${info.error}`);
        throw new EmbeddingUnavailableError(`No se pudo cargar el modelo de embeddings: ${info.error}`, error);
      }
    })();
    return loading;
  }

  async function runBatch(texts) {
    const run = qvac.embed({ modelId, text: texts });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      qvac.cancel({ requestId: run.requestId }).catch(() => {});
    }, timeoutMs);
    try {
      const { embedding } = await run;
      return normalizeBatch(embedding, texts.length, info.dim);
    } catch (error) {
      if (error instanceof InvalidEmbeddingError) throw error;
      if (timedOut) throw new EmbeddingUnavailableError(`QVAC no generó los embeddings en ${Math.round(timeoutMs / 1000)} s.`, error);
      throw new EmbeddingUnavailableError(`Falló la generación de embeddings: ${error?.message || error}`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  async function embedAll(texts) {
    if (!Array.isArray(texts) || !texts.length) return [];
    if (texts.some((t) => typeof t !== 'string' || !t.trim())) throw new InvalidEmbeddingError('Hay un texto vacío en el lote.');
    if (info.status !== 'ready') await load();
    const out = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const vectors = await runBatch(texts.slice(i, i + batchSize));
      info.dim ??= vectors[0].length;
      out.push(...vectors);
    }
    return out;
  }

  return {
    load,
    describe: () => ({ ...info }),
    /**
     * Genera los vectores (normalizados) de varios textos, en cola y por lotes.
     * @returns {Promise<{ vectors: number[][], dim: number, model: string, modelVersion: string|null }>}
     */
    embed(texts) {
      const job = queue.then(async () => {
        const vectors = await embedAll(texts);
        return { vectors, dim: vectors[0]?.length ?? info.dim, model: modelName, modelVersion: info.modelVersion };
      });
      queue = job.catch(() => {});
      return job;
    },
    /** Descarga el modelo de embeddings (sin borrar los pesos del disco). */
    async close() {
      if (!modelId) return;
      await queue;
      try {
        await qvac.unloadModel({ modelId, clearStorage: false });
      } finally {
        modelId = null;
        loading = null;
        info.status = 'idle';
      }
    },
  };
}
