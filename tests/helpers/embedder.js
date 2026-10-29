import { createHash } from 'node:crypto';
import { normalizeBatch } from '../../server/qvac/embeddings.js';

/**
 * Embedder SIMULADO y determinista: el mismo texto da el mismo vector.
 * Sirve para probar el almacenamiento y la lógica sin cargar QVAC.
 * `fail` (Error) hace fallar la generación; `raw` permite devolver vectores
 * defectuosos para probar la validación del almacenamiento.
 */
export function fakeEmbedder({ dim = 8, fail = null, raw = null } = {}) {
  const calls = [];
  return {
    calls,
    describe: () => ({ engine: 'simulado', model: 'TEST_EMBED', modelVersion: 'test-v1', dim, status: 'ready' }),
    async embed(texts) {
      calls.push(texts);
      if (fail) throw fail;
      if (raw) return { vectors: raw(texts), dim, model: 'TEST_EMBED', modelVersion: 'test-v1' };
      const vectors = texts.map((t) => {
        const h = createHash('sha256').update(t).digest();
        return Array.from({ length: dim }, (_, i) => h[i] / 255 - 0.5);
      });
      return { vectors: normalizeBatch(vectors, texts.length, dim), dim, model: 'TEST_EMBED', modelVersion: 'test-v1' };
    },
  };
}
