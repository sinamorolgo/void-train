from __future__ import annotations

import json
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.ftp_model_registry import FtpModelRegistry


class FtpModelRegistryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix="ftp-registry-test-")
        self.root = Path(self.temp_dir.name)
        self.registry = FtpModelRegistry(self.root / "registry")

        self.source = self.root / "source"
        self.source.mkdir(parents=True, exist_ok=True)
        (self.source / "model.pt").write_bytes(b"fake-model")
        (self.source / "labels.json").write_text(json.dumps({"0": "cat", "1": "dog"}), encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_publish_local_and_resolve_latest(self) -> None:
        published = self.registry.publish_from_local(
            model_name="Pet Classifier",
            stage="dev",
            local_source_path=str(self.source),
            version=None,
            set_latest=True,
            notes="first publish",
            source_metadata={"type": "local", "ticket": "ML-100"},
        )

        self.assertEqual(published["version"], "v0001")
        self.assertTrue((self.registry.root_dir / "dev" / "pet-classifier" / "LATEST").exists())

        resolved = self.registry.resolve("dev", "Pet Classifier", "latest")
        self.assertEqual(resolved["resolvedVersion"], "v0001")

        bundle_path = self.registry.root_dir / resolved["bundlePath"].lstrip("/")
        self.assertTrue(bundle_path.exists())

        with tarfile.open(bundle_path, "r:gz") as archive:
            names = archive.getnames()
            self.assertIn("payload/model.pt", names)
            self.assertIn("payload/labels.json", names)

    def test_promote_dev_to_release(self) -> None:
        self.registry.publish_from_local(
            model_name="Pet Classifier",
            stage="dev",
            local_source_path=str(self.source),
            version="v0100",
            set_latest=True,
            notes=None,
            source_metadata={"type": "local"},
        )

        promoted = self.registry.promote(
            model_name="Pet Classifier",
            from_stage="dev",
            to_stage="release",
            version="latest",
            target_version="v0200",
            set_latest=True,
            notes="release candidate",
        )

        self.assertEqual(promoted["stage"], "release")
        self.assertEqual(promoted["version"], "v0200")

        release_model = self.registry.get_model("release", "Pet Classifier")
        self.assertEqual(release_model["latest"], "v0200")
        self.assertEqual(len(release_model["versions"]), 1)

    def test_publish_from_mlflow_fallback_artifact_path(self) -> None:
        def _fake_download_artifact(
            tracking_uri: str,
            *,
            run_id: str,
            artifact_path: str,
            destination_dir: str,
        ) -> str:
            self.assertEqual(tracking_uri, "http://127.0.0.1:5001")
            self.assertEqual(run_id, "run-123")
            if artifact_path in {"model", "best_checkpoint.pt"}:
                raise FileNotFoundError(f"missing artifact: {artifact_path}")
            if artifact_path == "checkpoints/best_checkpoint.pt":
                target = Path(destination_dir) / "best_checkpoint.pt"
                target.write_bytes(b"fake-pt")
                return str(target)
            raise AssertionError(f"unexpected artifact_path: {artifact_path}")

        with patch("app.services.ftp_model_registry.download_artifact", side_effect=_fake_download_artifact):
            published = self.registry.publish_from_mlflow(
                model_name="Pet Classifier",
                stage="dev",
                version=None,
                set_latest=True,
                notes=None,
                tracking_uri="http://127.0.0.1:5001",
                run_id="run-123",
                artifact_path="model",
            )

        self.assertEqual(published["version"], "v0001")
        model = self.registry.get_model("dev", "Pet Classifier")
        source = model["versions"][0]["source"]
        self.assertEqual(source["type"], "mlflow")
        self.assertEqual(source["artifactPath"], "model")
        self.assertEqual(source["resolvedArtifactPath"], "checkpoints/best_checkpoint.pt")


if __name__ == "__main__":
    unittest.main()
