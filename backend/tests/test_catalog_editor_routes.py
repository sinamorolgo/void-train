from __future__ import annotations

import hashlib
import tempfile
import textwrap
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from fastapi import HTTPException

import app.api.routes as routes
from app.api.schemas import RestoreCatalogRevisionRequest, SaveCatalogRequest, ValidateCatalogRequest
from app.core.catalog_repository import CatalogRevision
from app.core.task_catalog import validate_catalog_payload


def _classification_catalog_yaml() -> str:
    return textwrap.dedent(
        """
        tasks:
          - taskType: classification
            title: Classification
            baseTaskType: classification
            runner:
              target: backend/trainers/train_classification.py
        """
    ).strip() + "\n"


def _two_task_catalog_yaml() -> str:
    return textwrap.dedent(
        """
        tasks:
          - taskType: classification
            title: Classification
            baseTaskType: classification
            runner:
              target: backend/trainers/train_classification.py
          - taskType: segmentation
            title: Segmentation
            baseTaskType: segmentation
            runner:
              target: backend/trainers/train_segmentation.py
        """
    ).strip() + "\n"


class _FakeCatalogRepository:
    def __init__(self) -> None:
        self._revisions: list[CatalogRevision] = []
        self._next_id = 1

    def _new_revision(self, content: str, source: str) -> CatalogRevision:
        normalized = content if content.endswith("\n") else f"{content}\n"
        revision = CatalogRevision(
            revision_id=self._next_id,
            content=normalized,
            source=source,
            created_at=datetime.now(tz=timezone.utc),
            checksum=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
        )
        self._next_id += 1
        return revision

    def seed_if_empty(self, *, seed_file_path: Path, default_content: str) -> CatalogRevision:
        if self._revisions:
            return self._revisions[-1]
        content = seed_file_path.read_text(encoding="utf-8") if seed_file_path.exists() else default_content
        revision = self._new_revision(content, "bootstrap:file" if seed_file_path.exists() else "bootstrap:default")
        self._revisions.append(revision)
        return revision

    def latest(self) -> CatalogRevision | None:
        return self._revisions[-1] if self._revisions else None

    def list_revisions(self, *, limit: int = 30) -> list[CatalogRevision]:
        return list(reversed(self._revisions[-max(1, limit) :]))

    def save(self, content: str, *, source: str) -> CatalogRevision:
        normalized = content if content.endswith("\n") else f"{content}\n"
        checksum = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        latest = self.latest()
        if latest and latest.checksum == checksum:
            return latest
        revision = self._new_revision(normalized, source)
        self._revisions.append(revision)
        return revision

    def get(self, revision_id: int) -> CatalogRevision | None:
        for revision in self._revisions:
            if revision.revision_id == revision_id:
                return revision
        return None

    def restore(self, revision_id: int) -> CatalogRevision:
        revision = self.get(revision_id)
        if revision is None:
            raise KeyError(f"Catalog revision not found: {revision_id}")
        return self.save(revision.content, source=f"restore:{revision_id}")


class _FakeCatalogGetter:
    def __init__(self, repository: _FakeCatalogRepository) -> None:
        self.repository = repository
        self.cleared = False
        self.called = False

    def cache_clear(self) -> None:
        self.cleared = True

    def __call__(self) -> Any:
        self.called = True
        latest = self.repository.latest()
        if latest is None:
            raise AssertionError("No seeded catalog")
        parsed = routes.parse_catalog_yaml(latest.content, source="fake-repo")
        return validate_catalog_payload(parsed, source="fake-repo")


class CatalogEditorRoutesTest(unittest.TestCase):
    def test_get_catalog_and_save_with_backup_revision(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catalog-editor-routes-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(_classification_catalog_yaml(), encoding="utf-8")
            fake_repo = _FakeCatalogRepository()
            fake_getter = _FakeCatalogGetter(fake_repo)

            with (
                patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)),
                patch.object(routes, "get_catalog_repository", return_value=fake_repo),
                patch.object(routes, "get_task_catalog", fake_getter),
            ):
                initial = routes.get_catalog()
                self.assertEqual(initial["taskCount"], 1)
                self.assertEqual(initial["revisionId"], 1)

                saved = routes.save_catalog(
                    SaveCatalogRequest(content=_two_task_catalog_yaml(), createBackup=True)
                )

                self.assertTrue(saved["saved"])
                self.assertEqual(saved["taskCount"], 2)
                self.assertEqual(saved["backupRevisionId"], 1)
                self.assertEqual(saved["revisionId"], 2)
                self.assertTrue(fake_getter.cleared)
                self.assertTrue(fake_getter.called)

    def test_validate_catalog_returns_400_for_invalid_payload(self) -> None:
        with self.assertRaises(HTTPException) as context:
            routes.validate_catalog(ValidateCatalogRequest(content="tasks: {}"))

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("tasks", str(context.exception.detail))

    def test_format_catalog_returns_normalized_yaml(self) -> None:
        payload = ValidateCatalogRequest(
            content=textwrap.dedent(
                """
                tasks:
                - runner:
                    target: backend/trainers/train_classification.py
                  baseTaskType: classification
                  title: Classification
                  taskType: classification
                """
            ).strip()
        )

        formatted = routes.format_catalog(payload)
        self.assertTrue(formatted["valid"])
        self.assertEqual(formatted["taskCount"], 1)
        self.assertIn("tasks:", formatted["content"])
        self.assertIn("taskType: classification", formatted["content"])
        self.assertTrue(formatted["content"].endswith("\n"))

    def test_history_and_restore(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catalog-history-routes-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(_classification_catalog_yaml(), encoding="utf-8")
            fake_repo = _FakeCatalogRepository()
            fake_getter = _FakeCatalogGetter(fake_repo)

            with (
                patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)),
                patch.object(routes, "get_catalog_repository", return_value=fake_repo),
                patch.object(routes, "get_task_catalog", fake_getter),
            ):
                routes.get_catalog()
                routes.save_catalog(SaveCatalogRequest(content=_two_task_catalog_yaml(), createBackup=True))

                history = routes.get_catalog_history(limit=10)
                self.assertEqual(history["storage"], "postgres")
                self.assertEqual(len(history["items"]), 2)
                self.assertEqual(history["items"][0]["revisionId"], 2)

                restored = routes.restore_catalog(RestoreCatalogRevisionRequest(revisionId=1))
                self.assertTrue(restored["saved"])
                self.assertEqual(restored["restoredFromRevisionId"], 1)
                self.assertEqual(restored["revisionId"], 3)


if __name__ == "__main__":
    unittest.main()
