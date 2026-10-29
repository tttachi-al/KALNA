-- 004 · Resultados del análisis de competencias con QVAC.
--
-- Reutiliza job_profiles, profile_competencies y competency_evidence (003).
-- Solo añade columnas y restricciones; no borra ni modifica datos.

-- Cómo se generó el perfil (sin transcripción: solo metadatos y lo que falta saber).
ALTER TABLE job_profiles
  ADD COLUMN missing_information      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN analysis_engine          text,
  ADD COLUMN analysis_model           text,
  ADD COLUMN analysis_prompt_version  text,
  ADD COLUMN analysis_ok              boolean,
  ADD COLUMN analyzed_at              timestamptz;

-- Escala provisional de nivel (server/competencies/schema.js) y su justificación.
ALTER TABLE profile_competencies
  ADD COLUMN level_reason text,
  ADD CONSTRAINT profile_competencies_level_check CHECK (level IS NULL OR level IN ('basico', 'intermedio', 'avanzado'));

-- Quién aportó cada evidencia y de qué tipo es la cita.
--   reglas:  motor de reglas durante la conversación
--   qvac:    análisis de competencias con QVAC (validado en código)
--   persona: ejemplo que la persona escribió en la etapa de ejemplos o en su perfil
ALTER TABLE competency_evidence
  ADD COLUMN origin      text NOT NULL DEFAULT 'reglas' CHECK (origin IN ('reglas', 'qvac', 'persona')),
  ADD COLUMN quote_type  text CHECK (quote_type IN ('ejemplo_concreto', 'afirmacion', 'indicio'));

-- Regenerar o volver a guardar el perfil no duplica evidencias.
CREATE UNIQUE INDEX competency_evidence_unique_quote ON competency_evidence (profile_id, competency_id, kind, md5(quote));
