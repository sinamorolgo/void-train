#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

uv lock

# Base backend dependencies for pip fallback
uv export \
  --frozen \
  --format requirements.txt \
  --no-default-groups \
  --only-group backend \
  --no-emit-project \
  --no-hashes \
  --output-file backend/requirements.txt \
  >/dev/null

# Optional file for MLflow + PostgreSQL backend mode
uv export \
  --frozen \
  --format requirements.txt \
  --no-default-groups \
  --group backend \
  --group postgres-mlflow \
  --no-emit-project \
  --no-hashes \
  --output-file backend/requirements-postgres-mlflow.txt \
  >/dev/null

echo "Updated:"
echo " - backend/requirements.txt"
echo " - backend/requirements-postgres-mlflow.txt"
