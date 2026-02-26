from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from app.core.settings import get_settings


@dataclass(frozen=True)
class CatalogRevision:
    revision_id: int
    content: str
    source: str
    created_at: datetime
    checksum: str


class CatalogRepository:
    def __init__(
        self,
        *,
        database_url: str | None,
        host: str,
        port: int,
        dbname: str,
        user: str,
        password: str,
        sslmode: str,
    ) -> None:
        self._database_url = database_url.strip() if database_url else None
        self._connect_kwargs = {
            "host": host,
            "port": port,
            "dbname": dbname,
            "user": user,
            "password": password,
            "sslmode": sslmode,
        }
        self._ensure_schema()

    def _connect(self):
        import psycopg2

        if self._database_url:
            return psycopg2.connect(self._database_url)
        return psycopg2.connect(**self._connect_kwargs)

    def _ensure_schema(self) -> None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                create table if not exists training_catalog_revisions (
                    id bigserial primary key,
                    content text not null,
                    source text not null default 'api',
                    checksum char(64) not null,
                    created_at timestamptz not null default now()
                );
                """
            )
            cursor.execute(
                """
                create index if not exists idx_training_catalog_revisions_created_at
                on training_catalog_revisions (created_at desc)
                """
            )
            connection.commit()

    def _row_to_revision(self, row: tuple[object, ...]) -> CatalogRevision:
        revision_id, content, source, checksum, created_at = row
        if not isinstance(revision_id, int):
            raise ValueError(f"Invalid revision id: {revision_id!r}")
        if not isinstance(content, str):
            raise ValueError("Catalog content is not text")
        if not isinstance(source, str):
            source = "api"
        if not isinstance(checksum, str):
            checksum = ""
        if not isinstance(created_at, datetime):
            raise ValueError("Catalog created_at is not datetime")
        return CatalogRevision(
            revision_id=revision_id,
            content=content,
            source=source,
            checksum=checksum,
            created_at=created_at,
        )

    def _checksum(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def latest(self) -> CatalogRevision | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                select id, content, source, checksum, created_at
                from training_catalog_revisions
                order by id desc
                limit 1
                """
            )
            row = cursor.fetchone()
            if row is None:
                return None
            return self._row_to_revision(row)

    def get(self, revision_id: int) -> CatalogRevision | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                select id, content, source, checksum, created_at
                from training_catalog_revisions
                where id = %s
                """,
                (revision_id,),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            return self._row_to_revision(row)

    def list_revisions(self, *, limit: int = 30) -> list[CatalogRevision]:
        safe_limit = max(1, min(limit, 200))
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                select id, content, source, checksum, created_at
                from training_catalog_revisions
                order by id desc
                limit %s
                """,
                (safe_limit,),
            )
            rows = cursor.fetchall()
            return [self._row_to_revision(row) for row in rows]

    def save(self, content: str, *, source: str) -> CatalogRevision:
        normalized = content if content.endswith("\n") else f"{content}\n"
        checksum = self._checksum(normalized)
        latest = self.latest()
        if latest and latest.checksum == checksum:
            return latest

        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                insert into training_catalog_revisions (content, source, checksum)
                values (%s, %s, %s)
                returning id, content, source, checksum, created_at
                """,
                (normalized, source, checksum),
            )
            row = cursor.fetchone()
            if row is None:
                raise RuntimeError("Failed to save catalog revision")
            connection.commit()
            return self._row_to_revision(row)

    def seed_if_empty(self, *, seed_file_path: Path, default_content: str) -> CatalogRevision:
        latest = self.latest()
        if latest:
            return latest

        file_content = (
            seed_file_path.read_text(encoding="utf-8")
            if seed_file_path.exists()
            else default_content
        )
        source = "bootstrap:file" if seed_file_path.exists() else "bootstrap:default"
        return self.save(file_content, source=source)

    def restore(self, revision_id: int) -> CatalogRevision:
        target = self.get(revision_id)
        if target is None:
            raise KeyError(f"Catalog revision not found: {revision_id}")
        return self.save(target.content, source=f"restore:{revision_id}")


@lru_cache(maxsize=1)
def get_catalog_repository() -> CatalogRepository:
    settings = get_settings()
    return CatalogRepository(
        database_url=settings.catalog_database_url,
        host=settings.catalog_db_host,
        port=settings.catalog_db_port,
        dbname=settings.catalog_db_name,
        user=settings.catalog_db_user,
        password=settings.catalog_db_password,
        sslmode=settings.catalog_db_sslmode,
    )
