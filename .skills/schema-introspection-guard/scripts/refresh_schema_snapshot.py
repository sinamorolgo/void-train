#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import psycopg2

EXCLUDED_SCHEMAS = {"pg_catalog", "information_schema"}


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def env_or_default(dotenv: dict[str, str], key: str, default: str | None = None) -> str | None:
    return os.getenv(key) or dotenv.get(key) or default


def build_connection_kwargs(dotenv: dict[str, str]) -> dict[str, str | int]:
    host = env_or_default(dotenv, "POSTGRES_HOST", "127.0.0.1")
    port = int(env_or_default(dotenv, "POSTGRES_PORT", "5432") or "5432")
    user = env_or_default(dotenv, "POSTGRES_USER")
    password = env_or_default(dotenv, "POSTGRES_PASSWORD")
    dbname = env_or_default(dotenv, "POSTGRES_DB")

    missing = [k for k, v in {
        "POSTGRES_USER": user,
        "POSTGRES_PASSWORD": password,
        "POSTGRES_DB": dbname,
    }.items() if not v]
    if missing:
        raise RuntimeError(f"Missing required DB settings: {', '.join(missing)}")

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "dbname": dbname,
        "connect_timeout": 5,
    }


def fetch_schema_rows(conn) -> list[tuple[str, str, str, str, str]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select
              c.table_schema,
              c.table_name,
              c.column_name,
              c.data_type,
              c.is_nullable
            from information_schema.columns c
            join information_schema.tables t
              on t.table_schema = c.table_schema
             and t.table_name = c.table_name
            where c.table_schema not in ('pg_catalog', 'information_schema')
              and t.table_type = 'BASE TABLE'
            order by c.table_schema, c.table_name, c.ordinal_position
            """
        )
        return list(cur.fetchall())


def render_snapshot(rows: list[tuple[str, str, str, str, str]], source_host: str, source_db: str) -> str:
    grouped: dict[tuple[str, str], list[tuple[str, str, str]]] = defaultdict(list)
    for schema, table, column, data_type, nullable in rows:
        grouped[(schema, table)].append((column, data_type, nullable))

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines: list[str] = [
        "# DB Schema Snapshot",
        "",
        f"- generated_at_local: {now}",
        f"- source: {source_host}/{source_db}",
        "- scope: non-system BASE TABLE columns from information_schema",
        "",
        "## Tables",
        "",
    ]

    current_schema = None
    for (schema, table), columns in grouped.items():
        if schema in EXCLUDED_SCHEMAS:
            continue
        if current_schema != schema:
            current_schema = schema
            lines.extend([f"### {schema}", ""])

        lines.append(f"#### {schema}.{table}")
        lines.append("")
        lines.append("| column | type | nullable |")
        lines.append("|---|---|---|")
        for name, data_type, nullable in columns:
            lines.append(f"| `{name}` | `{data_type}` | `{nullable}` |")
        lines.append("")

    lines.extend(
        [
            "## Quick Verification SQL",
            "",
            "```sql",
            "select table_schema, table_name",
            "from information_schema.tables",
            "where table_schema not in ('pg_catalog', 'information_schema')",
            "order by table_schema, table_name;",
            "```",
            "",
        ]
    )

    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh local DB schema snapshot for schema-introspection-guard skill")
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Path to .env file used for DB connection fallback (default: .env)",
    )
    parser.add_argument(
        "--output",
        default="skills/schema-introspection-guard/references/schema-snapshot.md",
        help="Output markdown file path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dotenv = load_env_file(Path(args.env_file))
    conn_kwargs = build_connection_kwargs(dotenv)

    with psycopg2.connect(**conn_kwargs) as conn:
        rows = fetch_schema_rows(conn)

    snapshot = render_snapshot(
        rows,
        source_host=str(conn_kwargs["host"]),
        source_db=str(conn_kwargs["dbname"]),
    )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(snapshot, encoding="utf-8")
    print(f"wrote {output_path} ({len(rows)} columns)")


if __name__ == "__main__":
    main()
