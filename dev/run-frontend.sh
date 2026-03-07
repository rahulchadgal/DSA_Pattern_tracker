#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../frontend-app"
npm install

PORT=3000
PIDS="$(lsof -ti tcp:${PORT} || true)"
if [ -n "${PIDS}" ]; then
  echo "Killing stale process(es) on port ${PORT}: ${PIDS}"
  kill ${PIDS} || true
  sleep 1
  STILL_RUNNING="$(lsof -ti tcp:${PORT} || true)"
  if [ -n "${STILL_RUNNING}" ]; then
    kill -9 ${STILL_RUNNING}
  fi
fi

npm run dev
