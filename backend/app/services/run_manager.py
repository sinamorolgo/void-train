from __future__ import annotations

import json
import subprocess
import sys
import threading
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.settings import get_settings
from app.core.train_config import (
    PROGRESS_PREFIX,
    RUN_META_PREFIX,
    TaskType,
    build_config,
    config_to_cli_args,
    config_to_dict,
)
from app.services.process_utils import build_pythonpath_env, stop_process


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _normalize_run_name(run_name: str) -> str:
    text = run_name.strip().lower().replace(" ", "-")
    return "".join(char for char in text if char.isalnum() or char in {"-", "_"}) or "run"


@dataclass
class RunRecord:
    run_id: str
    task_type: TaskType
    status: str
    command: list[str]
    config: dict[str, Any]
    started_at: str
    pid: int | None = None
    finished_at: str | None = None
    exit_code: int | None = None
    progress: dict[str, Any] = field(default_factory=dict)
    mlflow_run_id: str | None = None
    logs: deque[str] = field(default_factory=lambda: deque(maxlen=200))
    stop_requested: bool = False
    process: subprocess.Popen[str] | None = field(default=None, repr=False)

    def to_public(self) -> dict[str, Any]:
        return {
            "runId": self.run_id,
            "taskType": self.task_type,
            "status": self.status,
            "command": self.command,
            "config": self.config,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
            "pid": self.pid,
            "exitCode": self.exit_code,
            "progress": self.progress,
            "mlflowRunId": self.mlflow_run_id,
            "logs": list(self.logs),
        }


class RunManager:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._lock = threading.Lock()
        self._active: dict[str, RunRecord] = {}
        self._history: dict[str, RunRecord] = {}

    def _task_script(self, task_type: TaskType) -> Path:
        return (
            self._settings.classification_script
            if task_type == "classification"
            else self._settings.segmentation_script
        )

    def _prepare_config_paths(self, raw_config: dict[str, Any], task_type: TaskType) -> dict[str, Any]:
        updated = dict(raw_config)
        task_prefix = "clf" if task_type == "classification" else "seg"
        run_slug = _normalize_run_name(str(updated.get("run_name", "run")))

        output_root_raw = Path(str(updated.get("output_root", "./outputs"))).expanduser()
        output_root = (
            output_root_raw.resolve()
            if output_root_raw.is_absolute()
            else (self._settings.project_root / output_root_raw).resolve()
        )
        run_dir = output_root / task_type / f"{task_prefix}-{run_slug}-{uuid.uuid4().hex[:8]}"

        checkpoint_dir = Path(str(updated.get("checkpoint_dir", run_dir / "checkpoints"))).expanduser()
        tensorboard_dir = Path(str(updated.get("tensorboard_dir", run_dir / "tensorboard"))).expanduser()

        checkpoint_dir = (
            checkpoint_dir.resolve()
            if checkpoint_dir.is_absolute()
            else (self._settings.project_root / checkpoint_dir).resolve()
        )
        tensorboard_dir = (
            tensorboard_dir.resolve()
            if tensorboard_dir.is_absolute()
            else (self._settings.project_root / tensorboard_dir).resolve()
        )

        updated["output_root"] = str(run_dir)
        updated["checkpoint_dir"] = str(checkpoint_dir)
        updated["tensorboard_dir"] = str(tensorboard_dir)
        updated["dataset_root"] = str(Path(str(updated.get("dataset_root", "./datasets"))).expanduser())
        updated["mlflow_tracking_uri"] = str(
            updated.get("mlflow_tracking_uri") or self._settings.default_mlflow_tracking_uri
        )
        updated["mlflow_experiment"] = str(
            updated.get("mlflow_experiment") or self._settings.default_mlflow_experiment
        )

        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        tensorboard_dir.mkdir(parents=True, exist_ok=True)
        run_dir.mkdir(parents=True, exist_ok=True)

        return updated

    def start_run(self, task_type: TaskType, raw_config: dict[str, Any]) -> dict[str, Any]:
        script_path = self._task_script(task_type)
        if not script_path.exists():
            raise FileNotFoundError(f"Training script not found: {script_path}")

        prepared_values = self._prepare_config_paths(raw_config, task_type)
        config = build_config(task_type, prepared_values)
        config_data = config_to_dict(config)

        command = [sys.executable, str(script_path)] + config_to_cli_args(config)

        env = build_pythonpath_env(prepend_path=str(self._settings.backend_root))
        env["PYTHONUNBUFFERED"] = "1"
        env["MLFLOW_TRACKING_URI"] = str(config_data["mlflow_tracking_uri"])
        env["MLFLOW_EXPERIMENT"] = str(config_data["mlflow_experiment"])

        process = subprocess.Popen(
            command,
            cwd=str(self._settings.backend_root),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        run_id = uuid.uuid4().hex
        record = RunRecord(
            run_id=run_id,
            task_type=task_type,
            status="running",
            command=command,
            config=config_data,
            started_at=_utc_now(),
            pid=process.pid,
            process=process,
            logs=deque(maxlen=self._settings.runs_log_tail),
        )

        with self._lock:
            self._active[run_id] = record
            self._history[run_id] = record

        watcher = threading.Thread(target=self._watch_run, args=(run_id,), daemon=True)
        watcher.start()

        return record.to_public()

    def _watch_run(self, run_id: str) -> None:
        with self._lock:
            record = self._history.get(run_id)

        if record is None or record.process is None or record.process.stdout is None:
            return

        for line in record.process.stdout:
            cleaned = line.rstrip("\n")
            if not cleaned:
                continue

            with self._lock:
                record.logs.append(cleaned)

                if cleaned.startswith(PROGRESS_PREFIX):
                    try:
                        payload = cleaned.split(PROGRESS_PREFIX, 1)[1]
                        record.progress = json.loads(payload)
                    except json.JSONDecodeError:
                        pass
                elif cleaned.startswith(RUN_META_PREFIX):
                    try:
                        payload = cleaned.split(RUN_META_PREFIX, 1)[1]
                        data = json.loads(payload)
                        mlflow_run_id = data.get("mlflow_run_id")
                        if isinstance(mlflow_run_id, str):
                            record.mlflow_run_id = mlflow_run_id
                    except json.JSONDecodeError:
                        pass

        exit_code = record.process.wait()

        with self._lock:
            record.exit_code = exit_code
            record.finished_at = _utc_now()
            if record.stop_requested:
                record.status = "stopped"
            elif exit_code == 0:
                record.status = "completed"
            else:
                record.status = "failed"

            self._active.pop(run_id, None)

    def list_runs(self) -> list[dict[str, Any]]:
        with self._lock:
            all_runs = [record.to_public() for record in self._history.values()]

        return sorted(all_runs, key=lambda item: item["startedAt"], reverse=True)

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            record = self._history.get(run_id)
            return record.to_public() if record else None

    def stop_run(self, run_id: str) -> dict[str, Any]:
        with self._lock:
            record = self._history.get(run_id)
            if record is None:
                raise KeyError(f"Run not found: {run_id}")
            if record.process is None or record.status != "running":
                return record.to_public()

            record.stop_requested = True
            process = record.process

        stop_process(process, terminate_timeout_sec=8, kill_timeout_sec=3)

        with self._lock:
            record.status = "stopped"
            record.finished_at = record.finished_at or _utc_now()

        return record.to_public()


run_manager = RunManager()
