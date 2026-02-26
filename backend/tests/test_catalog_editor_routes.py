from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from fastapi import HTTPException

import app.api.routes as routes
from app.api.schemas import SaveCatalogRequest, ValidateCatalogRequest
from app.core.task_catalog import TaskCatalogService


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


class _FakeCatalogGetter:
    def __init__(self, catalog_path: Path) -> None:
        self.catalog_path = catalog_path
        self.cleared = False
        self.called = False

    def cache_clear(self) -> None:
        self.cleared = True

    def __call__(self) -> Any:
        self.called = True
        return TaskCatalogService(self.catalog_path).load()


class CatalogEditorRoutesTest(unittest.TestCase):
    def test_get_catalog_and_save_with_backup(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catalog-editor-routes-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(_classification_catalog_yaml(), encoding="utf-8")
            fake_getter = _FakeCatalogGetter(catalog_path)

            with (
                patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)),
                patch.object(routes, "get_task_catalog", fake_getter),
            ):
                initial = routes.get_catalog()
                self.assertEqual(initial["taskCount"], 1)
                self.assertTrue(initial["exists"])

                saved = routes.save_catalog(
                    SaveCatalogRequest(content=_two_task_catalog_yaml(), createBackup=True)
                )

                self.assertTrue(saved["saved"])
                self.assertEqual(saved["taskCount"], 2)
                self.assertTrue(fake_getter.cleared)
                self.assertTrue(fake_getter.called)

                backup_path = Path(str(saved["backupPath"]))
                self.assertTrue(backup_path.exists())
                self.assertIn("classification", backup_path.read_text(encoding="utf-8"))
                self.assertIn("segmentation", catalog_path.read_text(encoding="utf-8"))

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


if __name__ == "__main__":
    unittest.main()
