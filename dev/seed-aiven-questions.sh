#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.aiven"
SQL_BUILDER="${SCRIPT_DIR}/build-question-seed-sql.mjs"
INIT_SCRIPT="${SCRIPT_DIR}/init-aiven-schema.sh"
TMP_SQL="$(mktemp /tmp/dsa-seed-questions.XXXXXX.sql)"

cleanup() {
  rm -f "$TMP_SQL"
}
trap cleanup EXIT

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Install Node.js first." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools first." >&2
  exit 1
fi

: "${DB_URL:?DB_URL is required (jdbc:postgresql://host:port/database?sslmode=require)}"
: "${DB_USERNAME:?DB_USERNAME is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

"$INIT_SCRIPT"

node "$SQL_BUILDER" > "$TMP_SQL"

raw="${DB_URL#jdbc:postgresql://}"
host_port_db="${raw%%\?*}"
query=""
if [[ "$raw" == *\?* ]]; then
  query="${raw#*\?}"
fi

host_port="${host_port_db%%/*}"
database="${host_port_db#*/}"
host="$host_port"
port="5432"
if [[ "$host_port" == *:* ]]; then
  host="${host_port%%:*}"
  port="${host_port##*:}"
fi

psql_url="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${host}:${port}/${database}"
if [[ -n "$query" ]]; then
  if [[ "$query" == *"ssl=require"* ]] && [[ "$query" != *"sslmode="* ]]; then
    query="${query//ssl=require/sslmode=require}"
  fi
  psql_url="${psql_url}?${query}"
fi

echo "Seeding questions from frontend-app/constants.tsx into question_catalog ..."
psql "$psql_url" -v ON_ERROR_STOP=1 -f "$TMP_SQL"
echo "Question seeding completed."
