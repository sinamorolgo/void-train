from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch
import io

import app.api.routes as routes
from app.api.schemas import DownloadRegisteredFtpModelRequest, PublishBestFtpModelRequest
from app.core.task_catalog import TaskCatalogService
from fastapi import UploadFile


class _FakeCatalogGetter:
    def __init__(self, catalog_path: Path) -> None:
        self.catalog_path = catalog_path

    def cache_clear(self) -> None:  # pragma: no cover - compatibility only
        return None

    def __call__(self) -> Any:
        return TaskCatalogService(self.catalog_path).load()


class _FakeFtpRegistry:
    def get_model(self, stage: str, model_name: str) -> dict[str, Any]:
        if model_name == "classification-best-model" and stage == "release":
            return {
                "modelName": model_name,
                "stage": stage,
                "latest": "v0002",
                "updatedAt": "2026-02-25T12:00:00+00:00",
                "versions": [
                    {
                        "version": "v0002",
                        "createdAt": "2026-02-25T12:00:00+00:00",
                        "notes": "release",
                        "bundle": "/release/classification-best-model/versions/v0002/bundle.tar.gz",
                        "manifest": "/release/classification-best-model/versions/v0002/manifest.json",
                        "source": {"type": "mlflow"},
                    }
                ],
            }
        raise FileNotFoundError("not found")


class RegistryRoutesTest(unittest.TestCase):
    def test_get_mlflow_experiments(self) -> None:
        with (
            patch.object(
                routes,
                "settings",
                SimpleNamespace(default_mlflow_tracking_uri="http://127.0.0.1:5001"),
            ),
            patch.object(
                routes,
                "list_experiments",
                return_value=[
                    {"experimentId": "1", "name": "void-train-manager", "lifecycleStage": "active"},
                    {"experimentId": "2", "name": "seg-exp", "lifecycleStage": "active"},
                ],
            ) as mocked_list,
        ):
            payload = routes.get_mlflow_experiments()

        self.assertEqual(len(payload["items"]), 2)
        self.assertEqual(payload["items"][0]["name"], "void-train-manager")
        mocked_list.assert_called_once()

    def test_catalog_models_uses_registry_models_from_yaml(self) -> None:
        with tempfile.TemporaryDirectory(prefix="registry-routes-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    """
                    tasks:
                      - taskType: classification
                        title: Classification
                        baseTaskType: classification
                        runner:
                          target: backend/trainers/train_classification.py
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
            fake_getter = _FakeCatalogGetter(catalog_path)

            with (
                patch.object(routes, "get_task_catalog", fake_getter),
                patch.object(routes, "ftp_registry", _FakeFtpRegistry()),
            ):
                payload = routes.list_catalog_registry_models(includeVersions=True)

        self.assertEqual(len(payload["items"]), 1)
        item = payload["items"][0]
        self.assertEqual(item["id"], "classification")
        self.assertEqual(item["modelName"], "classification-best-model")
        self.assertTrue(item["stages"]["release"]["exists"])
        self.assertEqual(item["stages"]["release"]["latest"], "v0002")
        self.assertFalse(item["stages"]["dev"]["exists"])

    def test_download_registry_model_uses_defaults(self) -> None:
        resolved_payload = {
            "resolvedVersion": "v0003",
            "bundlePath": "/release/classification-best-model/versions/v0003/bundle.tar.gz",
            "manifestPath": "/release/classification-best-model/versions/v0003/manifest.json",
            "entry": {},
        }

        with (
            patch.object(routes, "settings", SimpleNamespace(
                ftp_default_host="0.0.0.0",
                ftp_default_port=2121,
                ftp_default_username="mlops",
                ftp_default_password="mlops123!",
            )),
            patch.object(
                routes,
                "ftp_registry",
                SimpleNamespace(resolve=lambda stage, model_name, version: resolved_payload),
            ),
            patch.object(routes, "download_file_via_ftp", return_value="/tmp/downloads/bundle.tar.gz") as mocked_download,
        ):
            result = routes.download_ftp_registry_model(
                DownloadRegisteredFtpModelRequest(
                    modelName="classification-best-model",
                    stage="release",
                    version="latest",
                    destinationDir="/tmp/downloads",
                )
            )

        self.assertEqual(result["resolvedVersion"], "v0003")
        self.assertEqual(result["artifact"], "bundle")
        self.assertEqual(result["remotePath"], resolved_payload["bundlePath"])
        self.assertEqual(result["localPath"], "/tmp/downloads/bundle.tar.gz")
        mocked_download.assert_called_once()
        called_kwargs = mocked_download.call_args.kwargs
        self.assertEqual(called_kwargs["host"], "127.0.0.1")
        self.assertEqual(called_kwargs["port"], 2121)
        self.assertEqual(called_kwargs["username"], "mlops")
        self.assertEqual(called_kwargs["password"], "mlops123!")

    def test_publish_best_to_ftp_registry(self) -> None:
        with tempfile.TemporaryDirectory(prefix="registry-best-") as temp_dir:
            catalog_path = Path(temp_dir) / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    """
                    tasks:
                      - taskType: classification
                        title: Classification
                        baseTaskType: classification
                        runner:
                          target: backend/trainers/train_classification.py
                        mlflow:
                          metric: val_accuracy
                          mode: max
                          modelName: classification-best-model
                          artifactPath: model
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            fake_getter = _FakeCatalogGetter(catalog_path)

            with (
                patch.object(routes, "get_task_catalog", fake_getter),
                patch.object(
                    routes,
                    "settings",
                    SimpleNamespace(
                        default_mlflow_tracking_uri="http://127.0.0.1:5001",
                        default_mlflow_experiment="void-train-manager",
                    ),
                ),
                patch.object(
                    routes,
                    "select_best_run",
                    return_value=SimpleNamespace(
                        run_id="abc123run",
                        metric_name="val_accuracy",
                        metric_value=0.9321,
                        artifact_uri="mlflow-artifacts:/abc123run/artifacts",
                    ),
                ) as mocked_best,
                patch.object(
                    routes,
                    "ftp_registry",
                    SimpleNamespace(
                        publish_from_mlflow=lambda **kwargs: {
                            "modelName": kwargs["model_name"],
                            "stage": kwargs["stage"],
                            "version": kwargs.get("version") or "v0001",
                        }
                    ),
                ),
            ):
                result = routes.publish_best_to_ftp_registry(
                    PublishBestFtpModelRequest(
                        taskType="classification",
                        stage="dev",
                        experimentName="void-train-manager",
                        setLatest=True,
                    )
                )

        self.assertEqual(result["taskType"], "classification")
        self.assertEqual(result["runId"], "abc123run")
        self.assertEqual(result["published"]["modelName"], "classification-best-model")
        self.assertEqual(result["published"]["stage"], "dev")
        mocked_best.assert_called_once()

    def test_upload_local_to_ftp_registry(self) -> None:
        captured: dict[str, Any] = {}

        def _fake_publish_from_local(**kwargs: Any) -> dict[str, Any]:
            source_path = Path(str(kwargs["local_source_path"]))
            captured["exists"] = source_path.exists()
            captured["filename"] = source_path.name
            captured["bytes"] = source_path.read_bytes()
            captured["kwargs"] = kwargs
            return {
                "modelName": kwargs["model_name"],
                "stage": kwargs["stage"],
                "version": kwargs.get("version") or "v0007",
            }

        with patch.object(
            routes,
            "ftp_registry",
            SimpleNamespace(publish_from_local=_fake_publish_from_local),
        ):
            upload = UploadFile(filename="manual-model.pt", file=io.BytesIO(b"pt-binary"))
            result = routes.upload_local_to_ftp_registry(
                file=upload,
                modelName="segmentation-best-model",
                stage="release",
                version="v0100",
                setLatest="true",
                notes="manual upload",
                convertToTorchStandard="true",
                torchTaskType="segmentation",
                torchNumClasses=2,
            )

        self.assertEqual(result["uploadedFilename"], "manual-model.pt")
        self.assertEqual(result["published"]["stage"], "release")
        self.assertTrue(captured["exists"])
        self.assertEqual(captured["filename"], "manual-model.pt")
        self.assertEqual(captured["bytes"], b"pt-binary")
        self.assertEqual(captured["kwargs"]["source_metadata"]["type"], "upload")
        self.assertEqual(captured["kwargs"]["source_metadata"]["filename"], "manual-model.pt")


if __name__ == "__main__":
    unittest.main()
