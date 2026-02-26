---
name: void-dependency-management
description: Manage Python dependencies in void-train-manager with uv sync as default and pip requirements as fallback.
---

# Void Dependency Management

Use this skill when adding, updating, or auditing Python dependencies in `void-train-manager`.

## Source of truth

- `pyproject.toml` dependency groups
  - `backend`
  - `postgres-mlflow` (optional)
- `uv.lock` must be committed with dependency changes.

## Install commands

### Default (`uv`)

```bash
uv venv .venv --python 3.11
uv sync --python .venv/bin/python --only-group backend --no-default-groups
```

### Optional MLflow PostgreSQL mode

```bash
uv sync --python .venv/bin/python --group backend --group postgres-mlflow --no-default-groups
```

### pip fallback

```bash
.venv/bin/python -m pip install -r backend/requirements.txt
```

For PostgreSQL mode:

```bash
.venv/bin/python -m pip install -r backend/requirements-postgres-mlflow.txt
```

## Update workflow

1. Edit dependency groups in `pyproject.toml`.
2. Run:
   - `./backend/scripts/sync_requirements.sh`
3. Commit all of:
   - `pyproject.toml`
   - `uv.lock`
   - `backend/requirements.txt`
   - `backend/requirements-postgres-mlflow.txt`
4. Smoke-check install:
   - `uv sync --python .venv/bin/python --only-group backend --no-default-groups`
