from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import app.api.routes as routes
from app.api.schemas import DownloadRegisteredFtpModelRequest
from app.core.task_catalog import TaskCatalogService


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


if __name__ == "__main__":
    unittest.main()
