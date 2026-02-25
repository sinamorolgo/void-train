#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_PYTHON="${VENV_PYTHON:-$BACKEND_ROOT/../.venv/bin/python}"

MLFLOW_HOME="${MLFLOW_HOME:-$BACKEND_ROOT/mlruns}"
MLFLOW_PORT="${MLFLOW_PORT:-5001}"
MLFLOW_HOST="${MLFLOW_HOST:-0.0.0.0}"

mkdir -p "$MLFLOW_HOME/artifacts"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Python executable not found at $VENV_PYTHON"
  echo "Run: uv venv .venv --python 3.11 && uv sync --python .venv/bin/python --only-group backend --no-default-groups"
  exit 1
fi

exec "$VENV_PYTHON" -m mlflow server \
  --host "$MLFLOW_HOST" \
  --port "$MLFLOW_PORT" \
  --backend-store-uri "sqlite:///$MLFLOW_HOME/mlflow.db" \
  --artifacts-destination "$MLFLOW_HOME/artifacts"
