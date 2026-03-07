#!/usr/bin/env bash
set -euo pipefail

SCHEMA_FILE="$(cd "$(dirname "$0")/../backend-api/src/main/resources/db" && pwd)/schema.sql"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.aiven"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools first." >&2
  exit 1
fi

: "${DB_URL:?DB_URL is required (jdbc:postgresql://host:port/database?sslmode=require)}"
: "${DB_USERNAME:?DB_USERNAME is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Schema file not found: $SCHEMA_FILE" >&2
  exit 1
fi

if [[ "$DB_URL" != jdbc:postgresql://* ]]; then
  echo "DB_URL must start with jdbc:postgresql://" >&2
  exit 1
fi

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

echo "Applying schema to ${host}:${port}/${database} ..."
psql "$psql_url" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"
echo "Schema applied successfully."
