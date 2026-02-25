---
name: schema-introspection-guard
description: Use this skill when running DB queries/debugging in OneSearch to prevent schema mismatch errors by checking a preloaded schema snapshot first and refreshing it from live DB when needed.
---

# Schema Introspection Guard

Use this skill for any DB investigation where `UndefinedTable`, `UndefinedColumn`, or `current transaction is aborted` can happen.

## Workflow

1. Read `references/schema-snapshot.md` first and build queries from existing table/column names.
2. If snapshot is stale or missing a table/column, refresh it from live DB:
   - `.venv/bin/python skills/schema-introspection-guard/scripts/refresh_schema_snapshot.py`
3. Run `references/preload-queries.sql` to preload schema/table/column dictionaries in one shot.
4. Follow `references/query-playbook.md` for safe query patterns (autocommit/rollback guard).

## Rules

- Assume OneSearch DB timestamps are KST naive.
- Query with explicit schema names (`chatbot.rooms`, not `rooms`).
- On any SQL error in a session, run `rollback` before next query.
- Re-check columns via `information_schema.columns` before writing ad-hoc SQL that references new fields.
