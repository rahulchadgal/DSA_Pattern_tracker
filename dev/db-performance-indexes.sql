CREATE INDEX IF NOT EXISTS idx_progress_records_user_updated
  ON progress_records (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_progress_records_question
  ON progress_records (question_id);

CREATE INDEX IF NOT EXISTS idx_question_catalog_custom_imported_handle
  ON question_catalog (imported_by_handle, updated_at DESC)
  WHERE custom_imported = true;
