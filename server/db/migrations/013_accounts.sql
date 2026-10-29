-- 013 · Cuentas de usuario y sesiones (server/auth/).
--
-- - La contraseña se guarda como hash scrypt con sal (nunca en claro).
-- - La sesión se guarda como SHA-256 del token; el token solo vive en una
--   cookie HttpOnly del navegador.
-- - Un perfil laboral puede pertenecer a una cuenta (job_profiles.user_id).
--   Al eliminar la cuenta se eliminan sus perfiles y, en cascada, todo lo que
--   cuelga de ellos (competencias, evidencias, embeddings, rutas, pasaportes,
--   CV y evaluaciones).

CREATE TABLE IF NOT EXISTS user_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' in email) > 1),
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS account_sessions_user_idx ON account_sessions (user_id);

ALTER TABLE job_profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES user_accounts (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS job_profiles_user_idx ON job_profiles (user_id);
