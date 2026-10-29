-- 008 · Búsqueda semántica: varios vectores por competencia y por empleo, y
-- un vector por cada evidencia de la persona.
--
-- No borra datos. Solo cambia índices únicos (de una fila por texto a varias,
-- distinguidas por `chunk`) y crea evidence_embeddings.

-- Competencias del catálogo: descripción (chunk 0) + indicadores y ejemplos
-- (chunk 0..n dentro de cada tipo). Versión del contenido de referencia.
ALTER TABLE competency_embeddings
  ADD COLUMN chunk              integer NOT NULL DEFAULT 0 CHECK (chunk >= 0),
  ADD COLUMN reference_version  text;
DROP INDEX competency_embeddings_current;
CREATE UNIQUE INDEX competency_embeddings_current ON competency_embeddings (competency_id, text_kind, chunk, model, input_format);

-- Empleos: descripción general (chunk 0) + una fila por tarea.
ALTER TABLE occupation_embeddings
  ADD COLUMN chunk integer NOT NULL DEFAULT 0 CHECK (chunk >= 0);
DROP INDEX occupation_embeddings_current;
CREATE UNIQUE INDEX occupation_embeddings_current ON occupation_embeddings (occupation_id, text_kind, chunk, model, input_format);

-- Un vector por evidencia (cita) de la persona, no por conversación.
-- `text` es la cita tal como se embebió (sin datos de contacto).
CREATE TABLE evidence_embeddings (
  evidence_id    bigint NOT NULL REFERENCES competency_evidence (id) ON DELETE CASCADE,
  model          text NOT NULL,
  model_version  text,
  input_format   text NOT NULL CHECK (input_format IN ('retrieval_document', 'retrieval_query')),
  text           text NOT NULL,
  text_hash      text NOT NULL,
  dim            integer NOT NULL CHECK (dim > 0),
  embedding      vector NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evidence_id, model, input_format),
  CONSTRAINT evidence_embedding_dim CHECK (vector_dims(embedding) = dim)
);
CREATE INDEX evidence_embeddings_hash_idx ON evidence_embeddings (text_hash);
