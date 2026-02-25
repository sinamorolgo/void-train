#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_PYTHON="${VENV_PYTHON:-$BACKEND_ROOT/../.venv/bin/python}"

HOST="${APP_HOST:-0.0.0.0}"
PORT="${APP_PORT:-8008}"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Python executable not found at $VENV_PYTHON"
  echo "Run: uv venv .venv --python 3.11 && uv sync --python .venv/bin/python --only-group backend --no-default-groups"
  exit 1
fi

exec "$VENV_PYTHON" -m uvicorn app.main:app --app-dir "$BACKEND_ROOT" --host "$HOST" --port "$PORT" --reload
