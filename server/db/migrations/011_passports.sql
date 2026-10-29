CREATE TABLE IF NOT EXISTS employability_passports (
  profile_id uuid NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  occupation_id text NOT NULL,
  route jsonb NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(progress) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, occupation_id)
);
