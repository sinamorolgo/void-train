from __future__ import annotations

import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.task_catalog import TaskCatalogService
from app.services.run_manager import RunManager


class _FakeProcess:
    def __init__(self, pid: int = 43210) -> None:
        self.pid = pid
        self.stdout: list[str] = []

    def wait(self) -> int:
        return 0


def _argument_value(command: list[str], flag: str) -> str:
    index = command.index(flag)
    return command[index + 1]


class RunManagerExtraFieldsTest(unittest.TestCase):
    def test_start_run_appends_yaml_extra_fields_to_cli(self) -> None:
        with tempfile.TemporaryDirectory(prefix="run-manager-extra-") as temp_dir:
            temp_path = Path(temp_dir)
            script_path = temp_path / "train_external.py"
            script_path.write_text("print('ok')\n", encoding="utf-8")

            catalog_path = temp_path / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    f"""
                    tasks:
                      - taskType: cls-external
                        enabled: true
                        title: External Classification
                        baseTaskType: classification
                        runner:
                          startMethod: python_script
                          target: {script_path}
                        mlflow:
                          metric: val_accuracy
                          mode: max
                          modelName: cls-external-best
                          artifactPath: model
                        extraFields:
                          - name: train_profile
                            valueType: str
                            type: select
                            default: fast
                            required: true
                            choices: [fast, full]
                          - name: grad_clip
                            valueType: float
                            type: number
                            default: 0.5
                            cliArg: --grad-clip
                          - name: dry_run
                            valueType: bool
                            type: boolean
                            default: false
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )

            catalog = TaskCatalogService(catalog_path).load()
            fake_process = _FakeProcess()

            with (
                patch("app.services.run_manager.get_task_catalog", return_value=catalog),
                patch("app.services.run_manager.subprocess.Popen", return_value=fake_process) as popen_mock,
                patch.object(RunManager, "_watch_run", return_value=None),
            ):
                manager = RunManager()
                result = manager.start_run(
                    "cls-external",
                    {
                        "dataset_root": str(temp_path / "datasets"),
                        "output_root": str(temp_path / "outputs"),
                        "train_profile": "full",
                        "dry_run": True,
                    },
                )

            command = result["command"]
            self.assertEqual(command[1], str(script_path))
            self.assertEqual(_argument_value(command, "--train-profile"), "full")
            self.assertEqual(_argument_value(command, "--grad-clip"), "0.5")
            self.assertEqual(_argument_value(command, "--dry-run"), "true")
            self.assertEqual(result["config"]["train_profile"], "full")
            self.assertEqual(result["config"]["grad_clip"], 0.5)
            self.assertEqual(result["config"]["dry_run"], True)
            popen_mock.assert_called_once()

    def test_start_run_validates_missing_required_extra_field(self) -> None:
        with tempfile.TemporaryDirectory(prefix="run-manager-required-extra-") as temp_dir:
            temp_path = Path(temp_dir)
            script_path = temp_path / "train_external.py"
            script_path.write_text("print('ok')\n", encoding="utf-8")

            catalog_path = temp_path / "training_catalog.yaml"
            catalog_path.write_text(
                textwrap.dedent(
                    f"""
                    tasks:
                      - taskType: seg-external
                        enabled: true
                        title: External Segmentation
                        baseTaskType: segmentation
                        runner:
                          startMethod: python_script
                          target: {script_path}
                        mlflow:
                          metric: val_iou
                          mode: max
                          modelName: seg-external-best
                          artifactPath: model
                        extraFields:
                          - name: dataset_tag
                            valueType: str
                            required: true
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )

            catalog = TaskCatalogService(catalog_path).load()

            with patch("app.services.run_manager.get_task_catalog", return_value=catalog):
                manager = RunManager()
                with self.assertRaises(ValueError) as context:
                    manager.start_run(
                        "seg-external",
                        {
                            "dataset_root": str(temp_path / "datasets"),
                            "output_root": str(temp_path / "outputs"),
                        },
                    )

            self.assertIn("Missing required extra field: dataset_tag", str(context.exception))


if __name__ == "__main__":
    unittest.main()
