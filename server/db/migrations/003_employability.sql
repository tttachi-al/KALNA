-- 003 · Esquema de empleabilidad: catálogo, perfiles laborales y embeddings.
--
-- Solo estructura: esta migración no carga datos ni genera vectores.
--
-- Decisiones:
-- - Los ids del catálogo son los mismos de src/data (`org_materiales`,
--   `limpieza`, `aux_almacen`…) para no romper perfiles existentes.
-- - KALLPA todavía no tiene cuentas de usuario. El perfil laboral es la
--   entidad raíz de los datos de la persona; la relación con una futura tabla
--   de usuarios se añadirá en otra migración.
-- - No se guardan transcripciones: de la conversación solo se conservan las
--   citas que respaldan una competencia (evidencias).
-- - Los vectores no fijan la dimensión: el modelo de embeddings de QVAC aún
--   está por elegir. Cada fila guarda `model` y `dim`, y su texto exacto.
--   Con cientos de vectores basta una búsqueda exacta; un índice HNSW se crea
--   cuando el modelo (y por tanto la dimensión) quede fijado.

CREATE EXTENSION IF NOT EXISTS vector;

/* ───────── Catálogo (base de conocimiento) ───────── */

CREATE TABLE competency_families (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  short       text,
  ord         integer NOT NULL DEFAULT 0
);

CREATE TABLE competencies (
  id           text PRIMARY KEY,
  family_id    text NOT NULL REFERENCES competency_families (id),
  name         text NOT NULL,
  short        text,
  description  text NOT NULL,
  -- Procedencia del dato: demo → revisado → fuente_oficial
  validation   text NOT NULL DEFAULT 'demo' CHECK (validation IN ('demo', 'revisado', 'fuente_oficial')),
  source       text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE occupations (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  summary      text NOT NULL,
  -- reference: las cinco ocupaciones de KALLPA · job: puestos para postular (jobs.js)
  scope        text NOT NULL CHECK (scope IN ('reference', 'job')),
  validation   text NOT NULL DEFAULT 'demo' CHECK (validation IN ('demo', 'revisado', 'fuente_oficial')),
  source       text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE occupation_competencies (
  occupation_id  text NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
  competency_id  text NOT NULL REFERENCES competencies (id),
  weight         text NOT NULL CHECK (weight IN ('clave', 'complementaria')),
  PRIMARY KEY (occupation_id, competency_id)
);

/* ───────── Perfiles laborales de las personas ───────── */

CREATE TABLE job_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias         text,
  occupations   text[] NOT NULL DEFAULT '{}',   -- experiencia declarada (ids de ocupación)
  formality     text CHECK (formality IN ('formal', 'informal', 'ambos')),
  duration      text,                           -- rango declarado ('1a3', 'mas5'…)
  target_occupation_id text REFERENCES occupations (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Competencias identificadas en un perfil, con el estado del motor:
-- por_validar → declarada → evidencia. El nivel solo se registra cuando la
-- competencia tiene evidencia; la escala de niveles queda por definir.
CREATE TABLE profile_competencies (
  profile_id     uuid NOT NULL REFERENCES job_profiles (id) ON DELETE CASCADE,
  competency_id  text NOT NULL REFERENCES competencies (id),
  status         text NOT NULL CHECK (status IN ('por_validar', 'declarada', 'evidencia')),
  level          text,
  dismissed      boolean NOT NULL DEFAULT false,   -- la persona dijo que no la representa
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, competency_id),
  CONSTRAINT level_requires_evidence CHECK (level IS NULL OR status = 'evidencia')
);

-- Lo que respalda cada competencia: la cita textual de la persona (mención)
-- o el ejemplo concreto que aportó, con la calidad que asignó el motor.
CREATE TABLE competency_evidence (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id     uuid NOT NULL,
  competency_id  text NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('mencion', 'ejemplo')),
  quote          text NOT NULL CHECK (length(quote) > 0),
  source         text,                             -- etapa de la que salió ('tareas', 'entrevista'…)
  quality        text CHECK (quality IN ('fuerte', 'parcial', 'insuficiente')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (profile_id, competency_id) REFERENCES profile_competencies (profile_id, competency_id) ON DELETE CASCADE
);

CREATE INDEX competency_evidence_profile_idx ON competency_evidence (profile_id, competency_id);

/* ───────── Embeddings (texto descriptivo junto a su vector) ───────── */

-- Varios textos por competencia: definición, indicadores y ejemplos en el
-- lenguaje de la gente. `text` es el texto EXACTO que se embebió.
CREATE TABLE competency_embeddings (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  competency_id  text NOT NULL REFERENCES competencies (id) ON DELETE CASCADE,
  text_kind      text NOT NULL CHECK (text_kind IN ('descripcion', 'indicador', 'ejemplo')),
  text           text NOT NULL,
  text_hash      text NOT NULL,                    -- sha256 de `text`: re-embeber solo lo que cambió
  model          text NOT NULL,                    -- constante del SDK de QVAC usada
  dim            integer NOT NULL,
  embedding      vector NOT NULL,                  -- normalizado L2
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competency_id, model, text_hash),
  CONSTRAINT competency_embedding_dim CHECK (vector_dims(embedding) = dim)
);

CREATE TABLE occupation_embeddings (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occupation_id  text NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
  text_kind      text NOT NULL CHECK (text_kind IN ('descripcion', 'tareas', 'ejemplo')),
  text           text NOT NULL,
  text_hash      text NOT NULL,
  model          text NOT NULL,
  dim            integer NOT NULL,
  embedding      vector NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occupation_id, model, text_hash),
  CONSTRAINT occupation_embedding_dim CHECK (vector_dims(embedding) = dim)
);
