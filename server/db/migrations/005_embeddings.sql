-- 005 · Embeddings con QVAC Text Embeddings.
--
-- Reutiliza competency_embeddings y occupation_embeddings (003) para el
-- catálogo y añade la estructura mínima que faltaba: embeddings de las
-- competencias de CADA PERFIL (con su evidencia como contexto) y el estado de
-- generación para poder reintentar. No borra ni modifica datos.
--
-- Dimensión: EMBEDDINGGEMMA_300M_Q8_0 devuelve 768 (verificado con el modelo
-- real). La columna sigue sin dimensión fija para poder cambiar de modelo;
-- cada fila guarda `dim` y una restricción comprueba que coincide. El índice
-- HNSW se añadirá con la búsqueda (punto 4), por modelo:
--   CREATE INDEX … USING hnsw ((embedding::vector(768)) vector_cosine_ops) WHERE model = '…';

-- Catálogo: versión exacta del modelo y formato de entrada (prefijo de tarea).
ALTER TABLE competency_embeddings
  ADD COLUMN model_version  text,
  ADD COLUMN input_format   text NOT NULL DEFAULT 'retrieval_document' CHECK (input_format IN ('retrieval_document', 'retrieval_query'));
ALTER TABLE occupation_embeddings
  ADD COLUMN model_version  text,
  ADD COLUMN input_format   text NOT NULL DEFAULT 'retrieval_document' CHECK (input_format IN ('retrieval_document', 'retrieval_query'));

-- Un vector vigente por texto, modelo y formato: si el texto cambia, se reemplaza.
CREATE UNIQUE INDEX competency_embeddings_current ON competency_embeddings (competency_id, text_kind, model, input_format);
CREATE UNIQUE INDEX occupation_embeddings_current ON occupation_embeddings (occupation_id, text_kind, model, input_format);

-- Competencias de un perfil. `text` es el texto legible que se embebió
-- (nombre + descripción del catálogo + citas de la persona), nunca la conversación.
CREATE TABLE profile_competency_embeddings (
  profile_id      uuid NOT NULL,
  competency_id   text NOT NULL,
  text            text NOT NULL,
  text_hash       text NOT NULL,          -- sha256(modelo + formato + entrada): si no cambia, no se regenera
  evidence_count  integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  model           text NOT NULL,
  model_version   text,
  input_format    text NOT NULL CHECK (input_format IN ('retrieval_document', 'retrieval_query')),
  dim             integer NOT NULL CHECK (dim > 0),
  embedding       vector NOT NULL,        -- normalizado L2
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, competency_id, model, input_format),
  FOREIGN KEY (profile_id, competency_id) REFERENCES profile_competencies (profile_id, competency_id) ON DELETE CASCADE,
  CONSTRAINT profile_competency_embedding_dim CHECK (vector_dims(embedding) = dim)
);

-- Estado de generación por competencia del perfil (para reintentar).
-- «generado» solo se marca después de guardar el vector.
ALTER TABLE profile_competencies
  ADD COLUMN embedding_status      text NOT NULL DEFAULT 'pendiente' CHECK (embedding_status IN ('pendiente', 'generado', 'error')),
  ADD COLUMN embedding_error       text,
  ADD COLUMN embedding_updated_at  timestamptz;
