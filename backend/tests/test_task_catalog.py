from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path

from app.api.routes import _build_task_schema
from app.core.task_catalog import TaskCatalogService, validate_catalog_payload


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
                        extraFields:
                          - name: profile
                            valueType: str
                            type: select
                            required: true
                            default: fast
                            choices: [fast, full]
                            group: custom
                          - name: debug_mode
                            valueType: bool
                            type: boolean
                            default: false
                            cliArg: --debug
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
            self.assertEqual(task.default_field_values()["profile"], "fast")
            self.assertEqual(len(registry_models), 1)
            self.assertEqual(registry_models[0].task_type, "classification")
            self.assertEqual(registry_models[0].model_name, "cls-v2-best")
            self.assertEqual(len(task.extra_fields), 2)
            self.assertEqual(task.extra_fields[0].name, "profile")
            self.assertEqual(task.extra_fields[1].cli_flag(), "--debug")

            schema = _build_task_schema(task)
            self.assertEqual(schema["taskType"], "cls-v2")
            self.assertEqual(schema["title"], "Classification V2")
            self.assertEqual(schema["runner"]["startMethod"], "python_module")
            self.assertEqual(schema["fields"][0]["name"], "run_name")
            self.assertEqual(schema["fields"][0]["default"], "custom-run")
            self.assertEqual(schema["fields"][0]["label"], "Custom Run Name")
            self.assertTrue(all(field["name"] != "force_cpu" for field in schema["fields"]))
            schema_field_map = {field["name"]: field for field in schema["fields"]}
            self.assertIn("profile", schema_field_map)
            self.assertEqual(schema_field_map["profile"]["type"], "select")
            self.assertEqual(schema_field_map["profile"]["choices"], ["fast", "full"])
            self.assertIn("debug_mode", schema_field_map)
            self.assertEqual(schema_field_map["debug_mode"]["cliArg"], "--debug")

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

    def test_duplicate_task_type_raises(self) -> None:
        payload = {
            "tasks": [
                {
                    "taskType": "classification",
                    "title": "Classification 1",
                    "baseTaskType": "classification",
                    "runner": {"target": "backend/trainers/train_classification.py"},
                },
                {
                    "taskType": "classification",
                    "title": "Classification 2",
                    "baseTaskType": "classification",
                    "runner": {"target": "backend/trainers/train_classification.py"},
                },
            ]
        }
        with self.assertRaises(ValueError) as context:
            validate_catalog_payload(payload, source="test")

        self.assertIn("Duplicate taskType detected", str(context.exception))

    def test_duplicate_extra_field_name_raises(self) -> None:
        payload = {
            "tasks": [
                {
                    "taskType": "classification",
                    "title": "Classification",
                    "baseTaskType": "classification",
                    "runner": {"target": "backend/trainers/train_classification.py"},
                    "extraFields": [
                        {"name": "profile", "valueType": "str"},
                        {"name": "profile", "valueType": "str"},
                    ],
                }
            ]
        }
        with self.assertRaises(ValueError) as context:
            validate_catalog_payload(payload, source="test")

        self.assertIn("Duplicate extra field name", str(context.exception))

    def test_duplicate_registry_model_id_raises(self) -> None:
        payload = {
            "tasks": [
                {
                    "taskType": "classification",
                    "title": "Classification",
                    "baseTaskType": "classification",
                    "runner": {"target": "backend/trainers/train_classification.py"},
                }
            ],
            "registryModels": [
                {
                    "id": "clf-main",
                    "title": "Classification A",
                    "taskType": "classification",
                    "modelName": "classification-best-model",
                },
                {
                    "id": "CLF MAIN",
                    "title": "Classification B",
                    "taskType": "classification",
                    "modelName": "classification-best-model-b",
                },
            ],
        }

        with self.assertRaises(ValueError) as context:
            validate_catalog_payload(payload, source="test")

        self.assertIn("Duplicate registry model id", str(context.exception))

    def test_registry_models_derived_when_catalog_registry_empty(self) -> None:
        payload = {
            "tasks": [
                {
                    "taskType": "classification",
                    "title": "Classification",
                    "baseTaskType": "classification",
                    "runner": {"target": "backend/trainers/train_classification.py"},
                    "mlflow": {"modelName": "classification-best-model"},
                },
                {
                    "taskType": "segmentation",
                    "title": "Segmentation",
                    "baseTaskType": "segmentation",
                    "runner": {"target": "backend/trainers/train_segmentation.py"},
                    "mlflow": {"modelName": "segmentation-best-model"},
                },
            ],
            "registryModels": [],
        }

        catalog = validate_catalog_payload(payload, source="test")
        registry_models = catalog.list_registry_models()

        self.assertEqual(len(registry_models), 2)
        self.assertEqual(registry_models[0].model_id, "classification")
        self.assertEqual(registry_models[1].model_id, "segmentation")
        self.assertEqual(registry_models[0].default_stage, "release")
        self.assertEqual(registry_models[0].default_destination_dir, "./backend/artifacts/downloads")


if __name__ == "__main__":
    unittest.main()
