from __future__ import annotations

import socket
import tempfile
import threading
import unittest
from pathlib import Path

import torch
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer

from app.services.ftp_model_registry import FtpModelRegistry
from scripts.ftp_model_client import FtpModelClientConfig, get_ftp_model_registry_client


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class FtpModelClientIntegrationTest(unittest.TestCase):
    def test_download_and_import_standard_artifact(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ftp-client-it-") as temp_dir:
            root = Path(temp_dir)
            registry_root = root / "registry"
            source_dir = root / "source"
            source_dir.mkdir(parents=True, exist_ok=True)

            checkpoint_path = source_dir / "best_checkpoint.pth"
            torch.save(
                {
                    "task_type": "classification",
                    "num_classes": 2,
                    "model_state_dict": {"head.weight": torch.randn(2, 4)},
                },
                checkpoint_path,
            )

            registry = FtpModelRegistry(registry_root)
            registry.publish_from_local(
                model_name="Integration Model",
                stage="release",
                local_source_path=str(checkpoint_path),
                version="v0001",
                set_latest=True,
                notes=None,
                source_metadata={"type": "local"},
                convert_to_torch_standard=True,
                torch_task_type="classification",
                torch_num_classes=2,
            )

            username = "mlops"
            password = "mlops123!"
            port = _find_free_port()

            authorizer = DummyAuthorizer()
            authorizer.add_user(username, password, str(registry_root), perm="elradfmwMT")

            class _Handler(FTPHandler):
                pass

            _Handler.authorizer = authorizer
            server = FTPServer(("127.0.0.1", port), _Handler)
            def _serve() -> None:
                try:
                    server.serve_forever(timeout=0.2, blocking=True)
                except OSError:
                    # Server socket can be closed during test teardown.
                    return

            thread = threading.Thread(
                target=_serve,
                daemon=True,
            )
            thread.start()

            try:
                client = get_ftp_model_registry_client(
                    FtpModelClientConfig(
                        host="127.0.0.1",
                        port=port,
                        username=username,
                        password=password,
                        cache_root=str(root / "client-cache"),
                    )
                )
                bundle = client.get("release", "Integration Model", "latest")
                self.assertIsNotNone(bundle.preferred_weight_path)
                self.assertTrue(bundle.preferred_weight_path and bundle.preferred_weight_path.exists())

                loaded = torch.load(bundle.preferred_weight_path, map_location="cpu")
                self.assertEqual(loaded.get("standard_format"), "void_torch_checkpoint_v1")
                self.assertIn("model_state_dict", loaded)
            finally:
                server.close_all()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
