import { createRequire } from 'node:module';
import * as qvac from '@qvac/sdk';

export const SDK_VERSION = createRequire(import.meta.url)('@qvac/sdk/package').version;

/**
 * Cliente de generación de texto con QVAC (@qvac/sdk 0.22.0), solo para Node.
 *
 * Funciones usadas (todas documentadas en la versión instalada):
 *   loadModel({ modelSrc, modelConfig: { ctx_size }, onProgress })
 *   completion({ modelId, history, stream, responseFormat, generationParams }) → { requestId, events, final }
 *   cancel({ requestId }), unloadModel({ modelId }), close()
 *
 * Las peticiones se atienden de una en una: el modelo se carga sin
 * `parallel`, y así una persona no pisa la petición de otra.
 */
export class LlmUnavailableError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'LlmUnavailableError';
    this.retryable = true;
  }
}

/** Busca la constante del modelo entre las exportaciones del SDK; no admite nombres inventados. */
export function resolveModel(name) {
  const entry = qvac[name];
  if (!entry || typeof entry !== 'object' || typeof entry.src !== 'string') {
    throw new Error(`El modelo "${name}" no existe en @qvac/sdk ${SDK_VERSION}. Usa el nombre de una constante exportada (por ejemplo QWEN3_4B_INST_Q4_K_M).`);
  }
  if (entry.engine !== 'llamacpp-completion') {
    throw new Error(`"${name}" no es un modelo de generación de texto (engine: ${entry.engine}).`);
  }
  return entry;
}

/**
 * @param {object} o
 * @param {string} o.modelName  constante del SDK, por ejemplo 'QWEN3_4B_INST_Q4_K_M'
 * @param {number} o.ctxSize    contexto en tokens
 * @param {number} o.timeoutMs  tiempo máximo por petición
 * @param {(msg: string) => void} o.log
 */
export function createQvacLlm({ modelName, ctxSize = 8192, timeoutMs = 60000, log = () => {} }) {
  const info = { engine: 'qvac', sdk: SDK_VERSION, model: modelName, status: 'idle', progress: null, error: null, loadedAt: null };
  let modelId = null;
  let loading = null;
  let queue = Promise.resolve();

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const src = resolveModel(modelName);
        info.status = 'loading';
        let lastPct = -10;
        modelId = await qvac.loadModel({
          modelSrc: src,
          modelConfig: { ctx_size: ctxSize },
          onProgress: (p) => {
            info.progress = Math.round(p.percentage);
            if (p.percentage - lastPct >= 10 || p.percentage >= 100) {
              lastPct = p.percentage;
              log(`Descargando/cargando ${modelName}: ${info.progress}%`);
            }
          },
        });
        info.status = 'ready';
        info.loadedAt = new Date().toISOString();
        log(`Modelo listo: ${modelName} (modelId ${modelId})`);
      } catch (error) {
        info.status = 'error';
        info.error = error?.message || String(error);
        loading = null;
        log(`No se pudo cargar ${modelName}: ${info.error}`);
        throw error;
      }
    })();
    return loading;
  }

  async function runOnce({ history, responseFormat, generationParams }) {
    if (info.status !== 'ready' || !modelId) {
      const why = info.status === 'loading' ? `el modelo todavía se está cargando (${info.progress ?? 0}%)` : info.error || 'el modelo no está cargado';
      throw new LlmUnavailableError(`QVAC no está disponible: ${why}.`);
    }
    const run = qvac.completion({ modelId, history, stream: true, responseFormat, generationParams });
    let timedOut = false;
    let timer;
    // Si cancel() no cierra el stream, el plazo rechaza igualmente: la cola nunca queda bloqueada.
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        qvac.cancel({ requestId: run.requestId }).catch(() => {});
        reject(new Error('timeout'));
      }, timeoutMs);
    });
    try {
      let streamed = '';
      const consume = (async () => {
        for await (const ev of run.events) {
          if (ev.type === 'contentDelta') streamed += ev.text;
        }
        return run.final;
      })();
      consume.catch(() => {}); // tras el plazo, su fallo ya no tiene a quién avisar
      const final = await Promise.race([deadline, consume]);
      if (final.stopReason === 'error') throw new Error('La generación terminó con error.');
      return { text: final.contentText ?? streamed, model: modelName, stats: final.stats, stopReason: final.stopReason };
    } catch (error) {
      if (timedOut) throw new LlmUnavailableError(`QVAC no respondió en ${Math.round(timeoutMs / 1000)} s.`, error);
      if (error instanceof LlmUnavailableError) throw error;
      throw new LlmUnavailableError(`Falló la generación con QVAC: ${error?.message || error}`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    load,
    describe: () => ({ ...info }),
    /** Encola la petición y devuelve `{ text, model, stats, stopReason }`. */
    generate(params) {
      const job = queue.then(() => runOnce(params));
      queue = job.catch(() => {});
      return job;
    },
    async close() {
      try {
        if (modelId) await qvac.unloadModel({ modelId });
      } finally {
        await qvac.close();
      }
    },
  };
}
