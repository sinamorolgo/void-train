from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.ftp_model_client import (
    FtpModelClientConfig,
    FtpModelRegistryClient,
    get_ftp_model_registry_client,
)


class FtpModelClientTest(unittest.TestCase):
    def test_singleton_returns_same_instance_for_same_config(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ftp-client-cache-") as temp_dir:
            config = FtpModelClientConfig(
                host="127.0.0.1",
                port=2121,
                username="mlops",
                password="mlops123!",
                cache_root=temp_dir,
            )
            first = get_ftp_model_registry_client(config)
            second = get_ftp_model_registry_client(config)
            self.assertIs(first, second)
            self.assertIsInstance(first, FtpModelRegistryClient)

    def test_resolved_cache_root_uses_torch_hub_when_not_given(self) -> None:
        config = FtpModelClientConfig(host="127.0.0.1")
        root = config.resolved_cache_root
        self.assertIn("torch", str(root).lower())
        self.assertIn("void-train-manager", str(root))
        self.assertEqual(root.name, "ftp-model-registry")

    def test_preferred_weight_path_picks_best_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ftp-client-weights-") as temp_dir:
            payload = Path(temp_dir) / "payload"
            payload.mkdir(parents=True, exist_ok=True)
            (payload / "epoch_2.pt").write_bytes(b"a")
            (payload / "best_checkpoint.pt").write_bytes(b"b")

            client = FtpModelRegistryClient(
                FtpModelClientConfig(
                    host="127.0.0.1",
                    cache_root=temp_dir,
                )
            )
            preferred = client._preferred_weight_path(payload)  # noqa: SLF001
            self.assertEqual(preferred, payload / "best_checkpoint.pt")


if __name__ == "__main__":
    unittest.main()
