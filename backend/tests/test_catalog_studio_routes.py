from __future__ import annotations

import tempfile
import textwrap
import unittest
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
from app.core.task_catalog import TaskCatalogService


class _FakeCatalogGetter:
    def __init__(self, catalog_path: Path) -> None:
        self.catalog_path = catalog_path
        self.cleared = False
        self.called = False

    def cache_clear(self) -> None:
        self.cleared = True

    def __call__(self):
        self.called = True
        return TaskCatalogService(self.catalog_path).load()


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

            with patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)):
                payload = routes.get_catalog_studio()

        self.assertEqual(payload["taskCount"], 1)
        self.assertEqual(payload["registryModelCount"], 1)
        self.assertEqual(payload["tasks"][0]["taskType"], "classification")
        self.assertEqual(payload["tasks"][0]["extraFields"][0]["name"], "train_profile")
        self.assertEqual(payload["registryModels"][0]["id"], "classification")

    def test_save_catalog_studio_with_backup(self) -> None:
        with tempfile.TemporaryDirectory(prefix="catalog-studio-save-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text("tasks:\n  - taskType: classification\n    title: Classification\n    baseTaskType: classification\n    runner:\n      target: backend/trainers/train_classification.py\n", encoding="utf-8")

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
            fake_getter = _FakeCatalogGetter(catalog_path)

            with (
                patch.object(routes, "settings", SimpleNamespace(training_catalog_path=catalog_path)),
                patch.object(routes, "get_task_catalog", fake_getter),
            ):
                result = routes.save_catalog_studio(payload)
                self.assertTrue(result["saved"])
                self.assertEqual(result["taskCount"], 1)
                self.assertEqual(result["registryModelCount"], 1)
                self.assertIsNotNone(result["backupPath"])
                self.assertEqual(result["tasks"][0]["extraFields"][0]["name"], "dataset_variant")
                self.assertTrue(Path(str(result["backupPath"])).exists())
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
