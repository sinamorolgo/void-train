from __future__ import annotations

import hashlib
import tempfile
import textwrap
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import app.api.routes as routes
from app.api.schemas import (
    CatalogStudioRegistryModelItem,
    CatalogStudioTaskItem,
    SaveCatalogStudioRequest,
)
from app.core.catalog_repository import CatalogRevision
from app.core.task_catalog import validate_catalog_payload


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

    def save(self, content: str, *, source: str) -> CatalogRevision:
        normalized = content if content.endswith("\n") else f"{content}\n"
        checksum = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        latest = self.latest()
        if latest and latest.checksum == checksum:
            return latest
        revision = self._new_revision(normalized, source)
        self._revisions.append(revision)
        return revision


class _FakeCatalogGetter:
    def __init__(self, repository: _FakeCatalogRepository) -> None:
        self.repository = repository
        self.cleared = False
        self.called = False

    def cache_clear(self) -> None:
        self.cleared = True

    def __call__(self):
        self.called = True
        latest = self.repository.latest()
        if latest is None:
            raise AssertionError("No seeded catalog")
        parsed = routes.parse_catalog_yaml(latest.content, source="fake-repo")
        return validate_catalog_payload(parsed, source="fake-repo")


class CatalogStudioRoutesTest(unittest.TestCase):
    def test_get_catalog_studio(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catalog-studio-routes-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    """
                    tasks:
                      - taskType: classification
                        enabled: true
                        title: Classification
                        description: Image classification trainer
                        baseTaskType: classification
                        runner:
                          startMethod: python_script
                          target: backend/trainers/train_classification.py
                        mlflow:
                          metric: val_accuracy
                          mode: max
                          modelName: classification-best-model
                          artifactPath: model
                        extraFields:
                          - name: train_profile
                            valueType: str
                            type: select
                            default: fast
                            choices: [fast, full]
                    registryModels:
                      - id: classification
                        title: Classification Model
                        taskType: classification
                        modelName: classification-best-model
                        defaultStage: release
                        defaultVersion: latest
                        defaultDestinationDir: ./backend/artifacts/downloads
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            fake_repo = _FakeCatalogRepository()

            with (
                patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)),
                patch.object(routes, "get_catalog_repository", return_value=fake_repo),
            ):
                payload = routes.get_catalog_studio()

        self.assertEqual(payload["taskCount"], 1)
        self.assertEqual(payload["registryModelCount"], 1)
        self.assertEqual(payload["tasks"][0]["taskType"], "classification")
        self.assertEqual(payload["tasks"][0]["extraFields"][0]["name"], "train_profile")
        self.assertEqual(payload["registryModels"][0]["id"], "classification")
        self.assertEqual(payload["revisionId"], 1)

    def test_save_catalog_studio_with_backup_revision(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catalog-studio-save-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(
                "tasks:\n  - taskType: classification\n    title: Classification\n    baseTaskType: classification\n    runner:\n      target: backend/trainers/train_classification.py\n",
                encoding="utf-8",
            )

            payload = SaveCatalogStudioRequest(
                tasks=[
                    CatalogStudioTaskItem(
                        taskType="classification",
                        enabled=True,
                        title="Classification",
                        description="trainer",
                        baseTaskType="classification",
                        runnerStartMethod="python_script",
                        runnerTarget="backend/trainers/train_classification.py",
                        mlflowMetric="val_accuracy",
                        mlflowMode="max",
                        mlflowModelName="classification-best-model",
                        mlflowArtifactPath="model",
                        fieldOrder=["run_name"],
                        hiddenFields=[],
                        fieldOverrides={"run_name": {"default": "quick-run"}},
                        extraFields=[
                            {
                                "name": "dataset_variant",
                                "valueType": "str",
                                "type": "select",
                                "required": True,
                                "default": "v1",
                                "choices": ["v1", "v2"],
                                "group": "custom",
                            }
                        ],
                    )
                ],
                registryModels=[
                    CatalogStudioRegistryModelItem(
                        id="classification",
                        title="Classification Model",
                        taskType="classification",
                        modelName="classification-best-model",
                        defaultStage="release",
                        defaultVersion="latest",
                        defaultDestinationDir="./backend/artifacts/downloads",
                    )
                ],
                createBackup=True,
            )
            fake_repo = _FakeCatalogRepository()
            fake_getter = _FakeCatalogGetter(fake_repo)

            with (
                patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)),
                patch.object(routes, "get_catalog_repository", return_value=fake_repo),
                patch.object(routes, "get_task_catalog", fake_getter),
            ):
                result = routes.save_catalog_studio(payload)
                self.assertTrue(result["saved"])
                self.assertEqual(result["taskCount"], 1)
                self.assertEqual(result["registryModelCount"], 1)
                self.assertEqual(result["backupRevisionId"], 1)
                self.assertEqual(result["tasks"][0]["extraFields"][0]["name"], "dataset_variant")
                self.assertEqual(result["revisionId"], 2)
                self.assertTrue(fake_getter.cleared)
                self.assertTrue(fake_getter.called)

    def test_save_catalog_studio_requires_tasks(self) -> None:
        payload = SaveCatalogStudioRequest(tasks=[], registryModels=[], createBackup=False)
        with self.assertRaises(HTTPException) as context:
            routes.save_catalog_studio(payload)

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("No tasks configured", str(context.exception.detail))

    def test_save_catalog_studio_rejects_duplicate_task_type(self) -> None:
        payload = SaveCatalogStudioRequest(
            tasks=[
                CatalogStudioTaskItem(
                    taskType="classification",
                    enabled=True,
                    title="Classification A",
                    description="A",
                    baseTaskType="classification",
                    runnerStartMethod="python_script",
                    runnerTarget="backend/trainers/train_classification.py",
                    mlflowMetric="val_accuracy",
                    mlflowMode="max",
                    mlflowModelName="classification-best-model",
                    mlflowArtifactPath="model",
                ),
                CatalogStudioTaskItem(
                    taskType="classification",
                    enabled=True,
                    title="Classification B",
                    description="B",
                    baseTaskType="classification",
                    runnerStartMethod="python_script",
                    runnerTarget="backend/trainers/train_classification.py",
                    mlflowMetric="val_accuracy",
                    mlflowMode="max",
                    mlflowModelName="classification-best-model-b",
                    mlflowArtifactPath="model",
                ),
            ],
            registryModels=[],
            createBackup=False,
        )

        with self.assertRaises(HTTPException) as context:
            routes.save_catalog_studio(payload)

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Duplicate taskType detected", str(context.exception.detail))


if __name__ == "__main__":
    unittest.main()
