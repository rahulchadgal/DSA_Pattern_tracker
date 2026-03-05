#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../tooling"
mvn -pl shared-core -am clean install
