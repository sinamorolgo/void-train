#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

SKIP_FRONTEND=0
SKIP_BACKEND_TESTS=0
RUN_FRONTEND_BUILD=0

usage() {
  cat <<'EOF'
Usage: run_setup_and_checks.sh [options]

Options:
  --skip-frontend        Skip frontend dependency install and build
  --skip-backend-tests   Skip backend unittest smoke checks
  --frontend-build       Run frontend production build (pnpm run build)
  -h, --help             Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-frontend)
      SKIP_FRONTEND=1
      shift
      ;;
    --skip-backend-tests)
      SKIP_BACKEND_TESTS=1
      shift
      ;;
    --frontend-build)
      RUN_FRONTEND_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

cd "$REPO_ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but not found in PATH." >&2
  exit 1
fi

if [[ ! -x ".venv/bin/python" ]]; then
  echo "[setup] creating virtualenv (.venv)"
  uv venv .venv --python 3.11
fi

echo "[setup] syncing backend dependencies"
uv sync --python .venv/bin/python --only-group backend --no-default-groups

if [[ "$SKIP_BACKEND_TESTS" -eq 0 ]]; then
  echo "[test] running backend smoke unittest suite"
  PYTHONPATH=backend .venv/bin/python -m unittest \
    backend.tests.test_catalog_editor_routes \
    backend.tests.test_catalog_studio_routes \
    backend.tests.test_task_catalog \
    backend.tests.test_run_manager
fi

if [[ "$SKIP_FRONTEND" -eq 0 ]]; then
  echo "[setup] installing frontend dependencies"
  (
    cd frontend
    pnpm install
    if [[ "$RUN_FRONTEND_BUILD" -eq 1 ]]; then
      echo "[test] running frontend build"
      pnpm run build
    fi
  )
fi

echo "[done] setup and checks completed"
