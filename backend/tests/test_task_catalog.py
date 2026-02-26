from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path

from app.api.routes import _build_task_schema
from app.core.task_catalog import TaskCatalogService


class TaskCatalogTest(unittest.TestCase):
    def test_load_catalog_and_schema_override(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-catalog-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    """
                    tasks:
                      - taskType: cls-v2
                        enabled: true
                        title: "Classification V2"
                        description: "custom task"
                        baseTaskType: classification
                        runner:
                          startMethod: python_module
                          target: trainers.train_classification
                        mlflow:
                          metric: val_accuracy
                          mode: max
                          modelName: cls-v2-best
                          artifactPath: model
                        fieldOrder:
                          - run_name
                          - epochs
                        hiddenFields:
                          - force_cpu
                        fieldOverrides:
                          run_name:
                            default: custom-run
                            label: Custom Run Name
                    """
                ),
                encoding="utf-8",
            )

            service = TaskCatalogService(catalog_path)
            catalog = service.load()
            task = catalog.get_task("cls-v2")
            registry_models = catalog.list_registry_models()

            self.assertEqual(task.base_task_type, "classification")
            self.assertEqual(task.runner.start_method, "python_module")
            self.assertEqual(task.default_field_values()["run_name"], "custom-run")
            self.assertEqual(len(registry_models), 1)
            self.assertEqual(registry_models[0].task_type, "classification")
            self.assertEqual(registry_models[0].model_name, "cls-v2-best")

            schema = _build_task_schema(task)
            self.assertEqual(schema["taskType"], "cls-v2")
            self.assertEqual(schema["title"], "Classification V2")
            self.assertEqual(schema["runner"]["startMethod"], "python_module")
            self.assertEqual(schema["fields"][0]["name"], "run_name")
            self.assertEqual(schema["fields"][0]["default"], "custom-run")
            self.assertEqual(schema["fields"][0]["label"], "Custom Run Name")
            self.assertTrue(all(field["name"] != "force_cpu" for field in schema["fields"]))

    def test_load_catalog_with_registry_models(self) -> None:
        with tempfile.TemporaryDirectory(prefix="task-catalog-registry-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    """
                    tasks:
                      - taskType: classification
                        enabled: true
                        title: "Classification"
                        baseTaskType: classification
                        runner:
                          startMethod: python_script
                          target: backend/trainers/train_classification.py
                        mlflow:
                          metric: val_accuracy
                          mode: max
                          modelName: classification-best-model
                          artifactPath: model
                    registryModels:
                      - id: clf-main
                        title: "Classification Main"
                        taskType: classification
                        modelName: classification-best-model
                        defaultStage: release
                        defaultVersion: latest
                        defaultDestinationDir: ./downloads
                    """
                ),
                encoding="utf-8",
            )

            service = TaskCatalogService(catalog_path)
            catalog = service.load()
            registry_models = catalog.list_registry_models()

            self.assertEqual(len(registry_models), 1)
            self.assertEqual(registry_models[0].model_id, "clf-main")
            self.assertEqual(registry_models[0].default_stage, "release")
            self.assertEqual(registry_models[0].default_destination_dir, "./downloads")


if __name__ == "__main__":
    unittest.main()
