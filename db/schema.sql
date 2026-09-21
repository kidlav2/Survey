CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  organization text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL,
  estimated_time integer,
  thank_you_message text,
  show_survey_info boolean
);

CREATE TABLE IF NOT EXISTS survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name text,
  description text,
  order_index integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  type text,
  text text,
  options jsonb,
  required boolean,
  has_other_option boolean,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb,
  section_id uuid REFERENCES survey_sections(id) ON DELETE SET NULL,
  conditional_logic jsonb
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_email text,
  answers jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  language text,
  opted_in boolean,
  completed boolean,
  lng text
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization text;

CREATE TABLE IF NOT EXISTS survey_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, email)
);

CREATE INDEX IF NOT EXISTS surveys_owner_idx ON surveys (owner_id);
CREATE INDEX IF NOT EXISTS questions_survey_idx ON questions (survey_id);
CREATE INDEX IF NOT EXISTS sections_survey_idx ON survey_sections (survey_id);
CREATE INDEX IF NOT EXISTS responses_survey_idx ON responses (survey_id);
CREATE INDEX IF NOT EXISTS survey_shares_survey_idx ON survey_shares (survey_id);
CREATE INDEX IF NOT EXISTS survey_shares_email_idx ON survey_shares (email);
CREATE INDEX IF NOT EXISTS survey_shares_user_idx ON survey_shares (user_id);

CREATE TABLE IF NOT EXISTS survey_presence (
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  area text NOT NULL DEFAULT 'builder',
  question_id text,
  save_status text NOT NULL DEFAULT 'idle',
  save_epoch integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, user_id)
);

CREATE INDEX IF NOT EXISTS survey_presence_survey_idx ON survey_presence (survey_id, updated_at);
