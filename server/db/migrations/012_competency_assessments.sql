-- 012 · Evaluaciones de competencias (server/assessment/).
--
-- Un intento guarda las preguntas utilizadas (con su clave, que solo lee el
-- backend), las respuestas elegidas y los resultados corregidos por el servidor.
-- No se guarda el nombre del participante: solo se usa al generar la constancia.

CREATE TABLE IF NOT EXISTS competency_assessments (
  id          uuid PRIMARY KEY,
  profile_id  uuid REFERENCES job_profiles (id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('preparando', 'lista', 'completada', 'error')),
  data        jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competency_assessments_profile_idx ON competency_assessments (profile_id, created_at DESC);
