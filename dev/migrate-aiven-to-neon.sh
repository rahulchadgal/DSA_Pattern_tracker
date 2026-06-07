#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.neon-migration"
INDEX_SQL="${SCRIPT_DIR}/db-performance-indexes.sql"
COMMAND="${1:-all}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 not found. Install PostgreSQL client tools first." >&2
    exit 1
  fi
}

require_command psql
require_command pg_dump
require_command pg_restore

urlencode() {
  node -e "process.stdout.write(encodeURIComponent(process.argv[1] || ''))" "$1"
}

normalize_postgres_url() {
  local raw_url="${1:-}"
  local username="${2:-}"
  local password="${3:-}"

  if [[ -z "$raw_url" ]]; then
    echo ""
    return
  fi

  if [[ "$raw_url" == jdbc:postgresql://* ]]; then
    raw_url="postgresql://${raw_url#jdbc:postgresql://}"
  fi

  node - "$raw_url" "$username" "$password" <<'NODE'
const [rawUrl, username, password] = process.argv.slice(2);
const url = new URL(rawUrl);
if (username && !url.username) url.username = username;
if (password && !url.password) url.password = password;
const queryUser = url.searchParams.get('user');
const queryPassword = url.searchParams.get('password');
if (queryUser && !url.username) url.username = queryUser;
if (queryPassword && !url.password) url.password = queryPassword;
const ssl = url.searchParams.get('ssl') || url.searchParams.get('sslmode') || '';
url.searchParams.delete('user');
url.searchParams.delete('password');
url.searchParams.delete('ssl');
url.searchParams.delete('sslmode');
if ((ssl === 'require' || ssl === 'true' || ssl === '1') && !url.searchParams.has('sslmode')) {
  url.searchParams.set('sslmode', 'require');
}
process.stdout.write(url.toString());
NODE
}

AIVEN_URL="$(normalize_postgres_url "${AIVEN_DATABASE_URL:-${AIVEN_DB_URL:-}}" "${AIVEN_DB_USERNAME:-}" "${AIVEN_DB_PASSWORD:-}")"
NEON_DIRECT_URL="$(normalize_postgres_url "${NEON_DIRECT_DATABASE_URL:-}" "" "")"
NEON_POOLED_URL="$(normalize_postgres_url "${NEON_POOLED_DATABASE_URL:-}" "" "")"
DUMP_FILE="${MIGRATION_DUMP_FILE:-${SCRIPT_DIR}/aiven-to-neon.dump}"

require_urls() {
  if [[ -z "$AIVEN_URL" ]]; then
    echo "AIVEN_DATABASE_URL is required, or set AIVEN_DB_URL/AIVEN_DB_USERNAME/AIVEN_DB_PASSWORD." >&2
    exit 1
  fi
  if [[ -z "$NEON_DIRECT_URL" ]]; then
    echo "NEON_DIRECT_DATABASE_URL is required for restore/verify." >&2
    exit 1
  fi
}

query_counts() {
  local db_url="$1"
  psql "$db_url" -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT 'database_size_bytes=' || pg_database_size(current_database());
SELECT 'database_size_pretty=' || pg_size_pretty(pg_database_size(current_database()));
SELECT 'user_handles=' || COUNT(*) FROM user_handles;
SELECT 'question_catalog=' || COUNT(*) FROM question_catalog;
SELECT 'progress_records=' || COUNT(*) FROM progress_records;
SQL
}

preflight() {
  require_urls
  echo "Aiven preflight:"
  query_counts "$AIVEN_URL"
}

dump_aiven() {
  require_urls
  mkdir -p "$(dirname "$DUMP_FILE")"
  echo "Dumping Aiven public schema to ${DUMP_FILE} ..."
  pg_dump "$AIVEN_URL" \
    --schema=public \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="$DUMP_FILE"
  echo "Dump complete: ${DUMP_FILE}"
}

restore_neon() {
  require_urls
  if [[ ! -f "$DUMP_FILE" ]]; then
    echo "Dump file not found: ${DUMP_FILE}. Run dump first." >&2
    exit 1
  fi

  echo "Restoring ${DUMP_FILE} into Neon direct connection ..."
  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --dbname="$NEON_DIRECT_URL" \
    "$DUMP_FILE"

  echo "Resetting serial sequences ..."
  psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT setval(pg_get_serial_sequence('user_handles', 'id'), COALESCE((SELECT MAX(id) FROM user_handles), 1), (SELECT COUNT(*) > 0 FROM user_handles));
SELECT setval(pg_get_serial_sequence('question_catalog', 'id'), COALESCE((SELECT MAX(id) FROM question_catalog), 1), (SELECT COUNT(*) > 0 FROM question_catalog));
SELECT setval(pg_get_serial_sequence('progress_records', 'id'), COALESCE((SELECT MAX(id) FROM progress_records), 1), (SELECT COUNT(*) > 0 FROM progress_records));
SQL

  echo "Applying performance indexes ..."
  psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$INDEX_SQL"
}

verify_neon() {
  require_urls
  echo "Aiven counts:"
  query_counts "$AIVEN_URL"
  echo "Neon counts:"
  query_counts "$NEON_DIRECT_URL"
  echo "Neon indexes:"
  psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_progress_records_user_updated',
    'idx_progress_records_question',
    'idx_question_catalog_custom_imported_handle'
  )
ORDER BY indexname;
SQL
  if [[ -n "$NEON_POOLED_URL" ]]; then
    echo "Use this Neon pooled URL as Vercel DATABASE_URL:"
    echo "$NEON_POOLED_URL"
  fi
}

case "$COMMAND" in
  preflight)
    preflight
    ;;
  dump)
    dump_aiven
    ;;
  restore)
    restore_neon
    ;;
  verify)
    verify_neon
    ;;
  all)
    preflight
    dump_aiven
    restore_neon
    verify_neon
    ;;
  *)
    echo "Usage: $0 [preflight|dump|restore|verify|all]" >&2
    exit 1
    ;;
esac
