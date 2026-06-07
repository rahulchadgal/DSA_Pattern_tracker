import { query } from './db.js';

export const PERFORMANCE_INDEXES = [
  {
    name: 'idx_progress_records_user_updated',
    sql: 'CREATE INDEX IF NOT EXISTS idx_progress_records_user_updated ON progress_records (user_id, updated_at DESC)'
  },
  {
    name: 'idx_progress_records_question',
    sql: 'CREATE INDEX IF NOT EXISTS idx_progress_records_question ON progress_records (question_id)'
  },
  {
    name: 'idx_question_catalog_custom_imported_handle',
    sql: 'CREATE INDEX IF NOT EXISTS idx_question_catalog_custom_imported_handle ON question_catalog (imported_by_handle, updated_at DESC) WHERE custom_imported = true'
  }
];

export async function ensurePerformanceIndexes() {
  for (const index of PERFORMANCE_INDEXES) {
    await query(index.sql);
  }
  return PERFORMANCE_INDEXES.map((index) => index.name);
}
