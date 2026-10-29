-- 010 · Tablas de rutas laborales y CV (reconstrucción).
--
-- La migración 009 (`009_routes_and_cv.sql`) se aplicó en la base de desarrollo,
-- pero su archivo no está en el proyecto. Esta migración recrea esas dos tablas
-- con el mismo esquema SOLO si no existen: en una base que ya aplicó la 009 no
-- hace nada; en una base nueva las crea. No borra ni modifica datos.

CREATE TABLE IF NOT EXISTS employability_routes (
  profile_id     uuid NOT NULL REFERENCES job_profiles (id) ON DELETE CASCADE,
  occupation_id  text NOT NULL CHECK (occupation_id ~ '^[a-z][a-z0-9_]{1,79}$'),
  route          jsonb NOT NULL,
  progress       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, occupation_id),
  CONSTRAINT route_progress_object CHECK (jsonb_typeof(progress) = 'object')
);

CREATE TABLE IF NOT EXISTS profile_cv (
  profile_id            uuid PRIMARY KEY REFERENCES job_profiles (id) ON DELETE CASCADE,
  data                  jsonb NOT NULL,
  target_occupation_id  text CHECK (target_occupation_id IS NULL OR target_occupation_id ~ '^[a-z][a-z0-9_]{1,79}$'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cv_data_object CHECK (jsonb_typeof(data) = 'object')
);
