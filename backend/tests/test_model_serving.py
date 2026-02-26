from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import app.services.model_serving as model_serving


class _FakeProcess:
    def __init__(self, pid: int, poll_code: int | None = None) -> None:
        self.pid = pid
        self._poll_code = poll_code

    def poll(self) -> int | None:
        return self._poll_code


class ModelServingManagerTest(unittest.TestCase):
    def test_start_ray_server_builds_command(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ray-serve-test-") as temp_dir:
            backend_root = Path(temp_dir) / "backend"
            scripts_dir = backend_root / "scripts"
            scripts_dir.mkdir(parents=True, exist_ok=True)
            (scripts_dir / "run_ray_serve.py").write_text("# stub", encoding="utf-8")

            fake_settings = SimpleNamespace(backend_root=backend_root, project_root=Path(temp_dir))
            fake_process = _FakeProcess(pid=43210)

            with (
                patch.object(model_serving, "get_settings", return_value=fake_settings),
                patch.object(model_serving, "start_checked_process", return_value=fake_process) as mocked_start,
            ):
                manager = model_serving.ModelServingManager()
                result = manager.start_ray_server(
                    model_uri="models:/classification-best-model/1",
                    host="0.0.0.0",
                    port=7001,
                    app_name="demo-app",
                    route_prefix="predict",
                )

        self.assertEqual(result["status"], "running")
        self.assertEqual(result["appName"], "demo-app")
        self.assertEqual(result["routePrefix"], "/predict")
        self.assertEqual(result["pid"], 43210)

        call_args = mocked_start.call_args
        self.assertIsNotNone(call_args)
        command = call_args.args[0]
        self.assertIn("run_ray_serve.py", command[1])
        self.assertIn("--app-name", command)
        self.assertIn("--route-prefix", command)
        self.assertIn("/predict", command)

        env = call_args.kwargs["env"]
        self.assertIn("PYTHONPATH", env)
        self.assertTrue(env["PYTHONPATH"].startswith(str(Path(temp_dir) / "backend")))

    def test_stop_ray_server_updates_status(self) -> None:
        fake_settings = SimpleNamespace(backend_root=Path("/tmp/backend"), project_root=Path("/tmp"))
        fake_process = _FakeProcess(pid=1000)
        with patch.object(model_serving, "get_settings", return_value=fake_settings):
            manager = model_serving.ModelServingManager()

        manager._ray_servers["server-1"] = model_serving.RayServeRecord(
            server_id="server-1",
            model_uri="models:/m/1",
            host="127.0.0.1",
            port=7010,
            app_name="void-train-manager",
            route_prefix="/",
            started_at="2026-02-26T00:00:00+00:00",
            process=fake_process,
        )

        with patch.object(model_serving, "stop_process") as mocked_stop:
            payload = manager.stop_ray_server("server-1")

        self.assertEqual(payload["status"], "stopped")
        self.assertIsNotNone(payload["finishedAt"])
        mocked_stop.assert_called_once()

    def test_list_ray_server_marks_exited(self) -> None:
        fake_settings = SimpleNamespace(backend_root=Path("/tmp/backend"), project_root=Path("/tmp"))
        exited_process = _FakeProcess(pid=2000, poll_code=1)
        with patch.object(model_serving, "get_settings", return_value=fake_settings):
            manager = model_serving.ModelServingManager()

        manager._ray_servers["server-2"] = model_serving.RayServeRecord(
            server_id="server-2",
            model_uri="models:/m/2",
            host="127.0.0.1",
            port=7020,
            app_name="void-train-manager",
            route_prefix="/",
            started_at="2026-02-26T00:00:00+00:00",
            process=exited_process,
        )

        with patch.object(model_serving, "read_process_output", return_value="ray crashed"):
            items = manager.list_ray_servers()

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["status"], "exited")
        self.assertEqual(items[0]["lastError"], "ray crashed")


if __name__ == "__main__":
    unittest.main()
