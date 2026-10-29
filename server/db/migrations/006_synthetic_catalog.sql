-- 006 · Catálogo SINTÉTICO de empleos y perfiles de origen.
--
-- Dos entidades distintas:
--   - Perfiles de origen (origin_profiles): las personas del mercado objetivo,
--     según la experiencia que traen (los cinco segmentos de src/data/occupations.js).
--   - Empleos sintéticos (occupations con scope = 'synthetic'): puestos a los
--     que esas personas podrían aspirar, de cualquier sector.
-- Se conectan muchos a muchos (origin_profile_occupations), con justificación
-- y brechas. Un empleo no se duplica por ser pertinente para varios perfiles.
--
-- Los empleos sintéticos NO son vacantes: no tienen empresa, fecha ni enlace,
-- y `is_synthetic` lo deja explícito. No borra ni modifica datos existentes.

/* ───────── Perfiles de origen ───────── */

CREATE TABLE origin_profiles (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  summary              text NOT NULL,
  typical_experiences  text[] NOT NULL DEFAULT '{}',
  typical_tasks        text[] NOT NULL DEFAULT '{}',
  transferable_skills  text[] NOT NULL DEFAULT '{}',
  common_barriers      text[] NOT NULL DEFAULT '{}',
  source               text,
  catalog_version      text NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Competencias que las personas de cada perfil suelen haber desarrollado.
CREATE TABLE origin_profile_competencies (
  profile_id     text NOT NULL REFERENCES origin_profiles (id) ON DELETE CASCADE,
  competency_id  text NOT NULL REFERENCES competencies (id),
  kind           text NOT NULL CHECK (kind IN ('tecnica', 'transversal')),
  weight         text NOT NULL CHECK (weight IN ('clave', 'complementaria')),
  PRIMARY KEY (profile_id, competency_id)
);

/* ───────── Empleos sintéticos (reutiliza occupations) ───────── */

ALTER TABLE occupations DROP CONSTRAINT occupations_scope_check;
ALTER TABLE occupations ADD CONSTRAINT occupations_scope_check CHECK (scope IN ('reference', 'job', 'synthetic'));

ALTER TABLE occupations
  ADD COLUMN sector                text,
  ADD COLUMN description           text,
  ADD COLUMN tasks                 text[] NOT NULL DEFAULT '{}',
  ADD COLUMN responsibilities      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN responsibility_level  text CHECK (responsibility_level IN ('operativo', 'tecnico', 'supervision')),
  ADD COLUMN is_synthetic          boolean NOT NULL DEFAULT false,
  ADD COLUMN catalog_version       text,
  ADD CONSTRAINT occupations_synthetic_consistency
    CHECK ((is_synthetic AND scope = 'synthetic' AND catalog_version IS NOT NULL AND description IS NOT NULL)
           OR (NOT is_synthetic AND scope <> 'synthetic'));

-- Requisitos que no son competencias del catálogo (formación, licencias…).
CREATE TABLE occupation_requirements (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occupation_id  text NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('educacion', 'experiencia', 'certificacion', 'licencia', 'formacion', 'condicion')),
  description    text NOT NULL CHECK (length(description) > 0),
  mandatory      boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX occupation_requirements_unique ON occupation_requirements (occupation_id, kind, md5(description));

/* ───────── Relación perfil de origen ↔ empleo ───────── */

-- relation:
--   principal: el perfil para el que se generó el empleo (cuenta en la cuota de 20).
--   adicional: el empleo también es pertinente para este perfil.
CREATE TABLE origin_profile_occupations (
  profile_id           text NOT NULL REFERENCES origin_profiles (id) ON DELETE CASCADE,
  occupation_id        text NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
  relation             text NOT NULL CHECK (relation IN ('principal', 'adicional')),
  justification        text NOT NULL CHECK (length(justification) > 20),
  shared_competencies  text[] NOT NULL DEFAULT '{}',
  catalog_version      text NOT NULL,
  PRIMARY KEY (profile_id, occupation_id)
);
-- Cada empleo tiene un solo perfil principal.
CREATE UNIQUE INDEX origin_profile_occupations_one_principal ON origin_profile_occupations (occupation_id) WHERE relation = 'principal';

-- Brechas: competencias que faltan (cercanas o nuevas) y requisitos por verificar.
CREATE TABLE origin_profile_occupation_gaps (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id     text NOT NULL,
  occupation_id  text NOT NULL,
  gap_type       text NOT NULL CHECK (gap_type IN ('competencia_cercana', 'competencia_nueva', 'requisito')),
  competency_id  text REFERENCES competencies (id),
  description    text NOT NULL,
  FOREIGN KEY (profile_id, occupation_id) REFERENCES origin_profile_occupations (profile_id, occupation_id) ON DELETE CASCADE,
  CHECK ((gap_type = 'requisito') = (competency_id IS NULL))
);
CREATE UNIQUE INDEX origin_profile_occupation_gaps_unique
  ON origin_profile_occupation_gaps (profile_id, occupation_id, gap_type, coalesce(competency_id, ''), md5(description));
