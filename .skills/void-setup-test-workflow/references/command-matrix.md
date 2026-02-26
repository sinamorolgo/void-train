# Setup/Test Command Matrix

## Full bootstrap + smoke checks

```bash
.skills/void-setup-test-workflow/scripts/run_setup_and_checks.sh --frontend-build
```

## Backend only

```bash
.skills/void-setup-test-workflow/scripts/run_setup_and_checks.sh --skip-frontend
```

## Frontend deps only (no backend tests)

```bash
.skills/void-setup-test-workflow/scripts/run_setup_and_checks.sh --skip-backend-tests
```

## Manual commands

```bash
uv venv .venv --python 3.11
uv sync --python .venv/bin/python --only-group backend --no-default-groups
PYTHONPATH=backend .venv/bin/python -m unittest backend.tests.test_task_catalog
cd frontend && pnpm install && pnpm run build
```
