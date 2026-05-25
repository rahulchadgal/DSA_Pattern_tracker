CREATE TABLE IF NOT EXISTS user_handles (
  id BIGSERIAL PRIMARY KEY,
  handle VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  password_hash TEXT NOT NULL,
  disabled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_catalog (
  id BIGSERIAL PRIMARY KEY,
  leetcode_id VARCHAR(32) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  difficulty VARCHAR(16) NOT NULL,
  main_pattern VARCHAR(120) NOT NULL,
  sub_pattern VARCHAR(120) NOT NULL,
  link TEXT NOT NULL,
  default_question BOOLEAN NOT NULL DEFAULT TRUE,
  custom_imported BOOLEAN NOT NULL DEFAULT FALSE,
  imported_by_handle VARCHAR(64),
  content_type VARCHAR(32) NOT NULL DEFAULT 'QUESTION_ONLY',
  metadata_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES user_handles(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES question_catalog(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  CONSTRAINT uk_progress_user_question UNIQUE (user_id, question_id)
);
