#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.neon-migration"
ENVIRONMENT="${1:-production}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Install Node.js/npm first." >&2
  exit 1
fi

: "${NEON_POOLED_DATABASE_URL:?NEON_POOLED_DATABASE_URL is required in dev/.env.neon-migration}"

set_env() {
  local name="$1"
  local value="$2"

  npx vercel env rm "$name" "$ENVIRONMENT" --yes >/dev/null 2>&1 || true
  printf "%s" "$value" | npx vercel env add "$name" "$ENVIRONMENT"
}

set_env DATABASE_URL "$NEON_POOLED_DATABASE_URL"
set_env PG_USE_POOL "true"
set_env PG_POOL_MAX "1"
set_env PG_CONNECTION_TIMEOUT_MS "5000"
set_env PG_IDLE_TIMEOUT_MS "1000"

echo "Updated Vercel ${ENVIRONMENT} database env vars for Neon pooled Postgres."
echo "Run a production deploy after this script completes."
