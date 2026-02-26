---
name: void-setup-test-workflow
description: Standardize setup and smoke-test execution for void-train-manager. Use when preparing a new/local environment, validating backend/frontend after config or runtime changes, checking CI-like readiness before push, or quickly re-running repeatable setup/test commands.
---

# Void Setup Test Workflow

## Quick Start

Run the bundled script from repo root:

```bash
.skills/void-setup-test-workflow/scripts/run_setup_and_checks.sh --frontend-build
```

## Workflow

1. Ensure `.venv` exists (`uv venv`) and sync backend dependencies.
2. Run backend smoke unittests (`catalog routes`, `studio routes`, `task catalog`, `run manager`).
3. Install frontend dependencies and optionally run production build.
4. Report what passed, what was skipped, and exact failing command if any.

## Script Options

- `--skip-frontend`: Skip `pnpm install` and build checks.
- `--skip-backend-tests`: Skip backend smoke unittest suite.
- `--frontend-build`: Run `pnpm run build`.

## References

- Command matrix: `references/command-matrix.md`
- Runner script: `scripts/run_setup_and_checks.sh`
