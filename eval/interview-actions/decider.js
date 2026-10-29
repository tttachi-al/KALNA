import * as qvac from '@qvac/sdk';
import { SDK_VERSION } from '../../server/qvac/llm.js';

/**
 * HISTÓRICO — retirado de la aplicación el 2026-10-28 (docs/interview-actions-evaluacion.md).
 * Se conserva como registro de la integración evaluada; el servidor no lo importa.
 *
 * Cliente de QVAC Decisions (@qvac/sdk 0.22.0), solo para Node.
 *
 * Funciones usadas (documentadas en la versión instalada):
 *   loadModel({ modelSrc, modelType: 'llamacpp-decision', modelConfig }) → modelId
 *   decide({ modelId, state, questions })                                → { answers, usage }
 *   cancel({ requestId }), unloadModel({ modelId, clearStorage: false })
 *
 * Uso en KALLPA: SOLO elegir la siguiente acción de la entrevista
 * (eval/interview-actions/actions.js). No clasifica evidencias ni competencias: esa
 * tarea se evaluó y no se adoptó (docs/decisions-evaluacion.md).
 *
 * Ciclo de vida: se carga en la primera petición (348 MB el modelo por
 * defecto) y se reutiliza. `close()` solo descarga ESTE modelo: el worker de
 * QVAC lo cierra el cliente del LLM.
 */
export class DecisionUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DecisionUnavailableError';
    this.code = 'decisions_no_disponible';
    this.cause = cause;
  }
}

export function resolveDecisionModel(name) {
  const src = qvac[name];
  if (!src || typeof src !== 'object' || src.engine !== 'llamacpp-decision') throw new Error(`Modelo de decisiones no válido: ${name}`);
  return src;
}

export function createQvacDecider({ modelName = 'LAYA_MULTILINGUAL_322M_Q8_0', device = 'gpu', timeoutMs = 5000, log = () => {} } = {}) {
  const info = { engine: 'qvac-decisions', sdk: SDK_VERSION, model: modelName, use: 'siguiente_accion_entrevista', status: 'idle', error: null, loadedAt: null };
  let modelId = null;
  let loading = null;
  let queue = Promise.resolve();

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const src = resolveDecisionModel(modelName);
        info.status = 'loading';
        modelId = await qvac.loadModel({ modelSrc: src, modelType: 'llamacpp-decision', modelConfig: { device } });
        info.status = 'ready';
        info.error = null;
        info.loadedAt = new Date().toISOString();
        log(`Decisiones listas: ${modelName} (modelId ${modelId})`);
      } catch (error) {
        info.status = 'error';
        info.error = error?.message || String(error);
        loading = null;
        log(`No se pudo cargar ${modelName}: ${info.error}`);
        throw new DecisionUnavailableError(`No se pudo cargar el modelo de decisiones: ${info.error}`, error);
      }
    })();
    return loading;
  }

  async function runOnce({ state, questions }) {
    if (info.status !== 'ready') await load();
    const run = qvac.decide({ modelId, state, questions });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      qvac.cancel({ requestId: run.requestId }).catch(() => {});
    }, timeoutMs);
    try {
      return await run;
    } catch (error) {
      if (timedOut) throw new DecisionUnavailableError(`QVAC Decisions no respondió en ${timeoutMs} ms.`, error);
      throw new DecisionUnavailableError(`Falló QVAC Decisions: ${error?.message || error}`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    load,
    describe: () => ({ ...info }),
    /** Una petición `decide()` en cola (una activa por modelo). */
    decide(params) {
      const job = queue.then(() => runOnce(params));
      queue = job.catch(() => {});
      return job;
    },
    /** Descarga el modelo de decisiones (sin borrar los pesos del disco). */
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
