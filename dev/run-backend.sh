#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend-api"
mvn spring-boot:run
