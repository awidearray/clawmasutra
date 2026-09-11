CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE,
  password_hash text,
  name text NOT NULL,
  age integer NOT NULL,
  age_confirmed_at timestamptz NOT NULL,
  claim_token_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_age_adult CHECK (age >= 18)
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pairing_codes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  code_display text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_keys (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  gender text NOT NULL,
  seeking text[] NOT NULL,
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompts jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests text[] NOT NULL DEFAULT '{}',
  looking_for text NOT NULL DEFAULT 'dating',
  height_cm integer,
  occupation text NOT NULL DEFAULT '',
  agent_name text NOT NULL DEFAULT '',
  agent_style text NOT NULL DEFAULT '',
  autonomy_swipe text NOT NULL DEFAULT 'guarded',
  autonomy_message text NOT NULL DEFAULT 'guarded',
  autonomy_date text NOT NULL DEFAULT 'guarded',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_gender_ok CHECK (gender IN ('woman', 'man', 'nonbinary', 'other')),
  CONSTRAINT profiles_looking_ok CHECK (looking_for IN ('relationship', 'dating', 'friends', 'figuring-out')),
  CONSTRAINT profiles_swipe_ok CHECK (autonomy_swipe IN ('suggest', 'guarded', 'auto')),
  CONSTRAINT profiles_message_ok CHECK (autonomy_message IN ('suggest', 'guarded', 'auto')),
  CONSTRAINT profiles_date_ok CHECK (autonomy_date IN ('suggest', 'guarded', 'auto'))
);

CREATE TABLE IF NOT EXISTS swipes (
  id text PRIMARY KEY,
  from_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction text NOT NULL,
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'clawmasutra',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT swipes_direction_ok CHECK (direction IN ('like', 'pass', 'superlike')),
  CONSTRAINT swipes_not_self CHECK (from_profile_id <> to_profile_id),
  CONSTRAINT swipes_unique UNIQUE (from_profile_id, to_profile_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id text PRIMARY KEY,
  a_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  b_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unmatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_order CHECK (a_profile_id < b_profile_id),
  CONSTRAINT matches_unique UNIQUE (a_profile_id, b_profile_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_kind_ok CHECK (kind IN ('agent', 'human', 'system')),
  CONSTRAINT messages_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE TABLE IF NOT EXISTS date_proposals (
  id text PRIMARY KEY,
  match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  proposer_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  venue text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_proposer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dates_status_ok CHECK (status IN (
    'pending_proposer', 'pending_other', 'confirmed', 'declined', 'cancelled'
  ))
);

CREATE TABLE IF NOT EXISTS approvals (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approvals_kind_ok CHECK (kind IN ('swipe', 'message', 'date', 'contact', 'connector')),
  CONSTRAINT approvals_status_ok CHECK (status IN ('pending', 'approved', 'denied', 'expired'))
);

CREATE TABLE IF NOT EXISTS blocks (
  id text PRIMARY KEY,
  from_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_unique UNIQUE (from_profile_id, to_profile_id)
);

CREATE TABLE IF NOT EXISTS connectors (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connectors_app_ok CHECK (app IN ('hinge', 'tinder', 'bumble', 'feeld', 'okcupid')),
  CONSTRAINT connectors_unique UNIQUE (user_id, app)
);

CREATE TABLE IF NOT EXISTS connector_events (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS agent_keys_user_idx ON agent_keys (user_id);
CREATE INDEX IF NOT EXISTS swipes_from_idx ON swipes (from_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS swipes_to_idx ON swipes (to_profile_id);
CREATE INDEX IF NOT EXISTS matches_a_idx ON matches (a_profile_id);
CREATE INDEX IF NOT EXISTS matches_b_idx ON matches (b_profile_id);
CREATE INDEX IF NOT EXISTS messages_match_idx ON messages (match_id, created_at);
CREATE INDEX IF NOT EXISTS approvals_user_idx ON approvals (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_user_idx ON activity (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS connector_events_user_idx ON connector_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_published_idx ON profiles (is_published, gender);
