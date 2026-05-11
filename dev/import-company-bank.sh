#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.aiven"
SQL_BUILDER="${SCRIPT_DIR}/build-company-bank-import-sql.mjs"
TMP_SQL="$(mktemp /tmp/dsa-company-bank.XXXXXX.sql)"
REPO_URL="${COMPANY_BANK_REPO_URL:-https://github.com/rahulchadgal/leetcode-companywise-interview-questions.git}"
REPO_BRANCH="${COMPANY_BANK_REPO_BRANCH:-master}"
REPO_CACHE_DIR="${COMPANY_BANK_REPO_CACHE_DIR:-/tmp/leetcode-companywise-interview-questions}"
DRY_RUN="${1:-}"

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

if ! command -v git >/dev/null 2>&1; then
  echo "git not found. Install git first." >&2
  exit 1
fi

if [[ ! -d "$REPO_CACHE_DIR/.git" ]]; then
  echo "Cloning company bank repository into $REPO_CACHE_DIR ..."
  rm -rf "$REPO_CACHE_DIR"
  git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_CACHE_DIR"
else
  echo "Updating cached repository in $REPO_CACHE_DIR ..."
  git -C "$REPO_CACHE_DIR" fetch origin "$REPO_BRANCH" --depth 1
  git -C "$REPO_CACHE_DIR" reset --hard "origin/$REPO_BRANCH"
fi

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "Dry-run mode: parsing CSV and showing import summary only."
  node "$SQL_BUILDER" "$REPO_CACHE_DIR" --dry-run
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools first." >&2
  exit 1
fi

: "${DB_URL:?DB_URL is required (jdbc:postgresql://host:port/database?sslmode=require)}"
: "${DB_USERNAME:?DB_USERNAME is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

node "$SQL_BUILDER" "$REPO_CACHE_DIR" > "$TMP_SQL"

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

echo "Importing company question bank into question_catalog ..."
psql "$psql_url" -v ON_ERROR_STOP=1 -f "$TMP_SQL"
echo "Company bank import completed."
