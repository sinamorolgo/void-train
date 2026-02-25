from __future__ import annotations

import subprocess
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import torch

from app.core.settings import get_settings
from app.services.mlflow_service import build_mlflow_serve_command
from app.services.process_utils import build_pythonpath_env, read_process_output, start_checked_process, stop_process
from trainers.models import create_model


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


@dataclass
class MlflowServeRecord:
    server_id: str
    model_uri: str
    host: str
    port: int
    started_at: str
    status: str = "running"
    pid: int | None = None
    finished_at: str | None = None
    last_error: str | None = None
    process: subprocess.Popen[str] | None = field(default=None, repr=False)

    def to_public(self) -> dict[str, Any]:
        return {
            "serverId": self.server_id,
            "modelUri": self.model_uri,
            "host": self.host,
            "port": self.port,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
            "status": self.status,
            "pid": self.pid,
            "lastError": self.last_error,
        }


@dataclass
class LocalModelRecord:
    alias: str
    task_type: str
    path: str
    loaded_at: str
    num_classes: int
    model: torch.nn.Module

    def to_public(self) -> dict[str, Any]:
        return {
            "alias": self.alias,
            "taskType": self.task_type,
            "path": self.path,
            "loadedAt": self.loaded_at,
            "numClasses": self.num_classes,
        }


class ModelServingManager:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._mlflow_servers: dict[str, MlflowServeRecord] = {}
        self._local_models: dict[str, LocalModelRecord] = {}

    def start_mlflow_server(self, *, model_uri: str, host: str, port: int) -> dict[str, Any]:
        command = build_mlflow_serve_command(model_uri=model_uri, host=host, port=port)
        env = build_pythonpath_env(prepend_path=str(self._settings.backend_root))
        process = start_checked_process(
            command,
            env=env,
            startup_timeout_sec=1.2,
            error_prefix="MLflow serving failed to start",
        )

        server_id = uuid.uuid4().hex
        record = MlflowServeRecord(
            server_id=server_id,
            model_uri=model_uri,
            host=host,
            port=port,
            started_at=_utc_now(),
            pid=process.pid,
            process=process,
        )
        self._mlflow_servers[server_id] = record
        return record.to_public()

    def stop_mlflow_server(self, server_id: str) -> dict[str, Any]:
        record = self._mlflow_servers.get(server_id)
        if record is None:
            raise KeyError(f"MLflow server not found: {server_id}")

        if record.process is not None and record.status == "running":
            stop_process(record.process, terminate_timeout_sec=8, kill_timeout_sec=3)

        record.status = "stopped"
        record.finished_at = _utc_now()
        return record.to_public()

    def list_mlflow_servers(self) -> list[dict[str, Any]]:
        for record in self._mlflow_servers.values():
            if record.process is not None and record.status == "running":
                if record.process.poll() is not None:
                    record.status = "exited"
                    record.finished_at = record.finished_at or _utc_now()
                    combined = read_process_output(record.process, max_chars=5000)
                    if combined:
                        record.last_error = combined
        return [item.to_public() for item in self._mlflow_servers.values()]

    def load_local_model(
        self,
        *,
        alias: str,
        model_path: str,
        task_type: str | None = None,
        num_classes: int | None = None,
    ) -> dict[str, Any]:
        checkpoint = torch.load(model_path, map_location="cpu")

        if isinstance(checkpoint, torch.nn.Module):
            model = checkpoint
            inferred_task = task_type or "classification"
            inferred_classes = num_classes or 2
        elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            inferred_task = task_type or str(checkpoint.get("task_type", "classification"))
            inferred_classes = int(num_classes or checkpoint.get("num_classes", 2))
            model = create_model(inferred_task, inferred_classes)
            model.load_state_dict(checkpoint["model_state_dict"])
        else:
            raise ValueError(
                "Unsupported checkpoint format. Expected nn.Module or dict with model_state_dict."
            )

        model.eval()

        record = LocalModelRecord(
            alias=alias,
            task_type=inferred_task,
            path=model_path,
            loaded_at=_utc_now(),
            num_classes=inferred_classes,
            model=model,
        )
        self._local_models[alias] = record
        return record.to_public()

    def list_local_models(self) -> list[dict[str, Any]]:
        return [item.to_public() for item in self._local_models.values()]

    def predict(self, *, alias: str, inputs: Any) -> dict[str, Any]:
        record = self._local_models.get(alias)
        if record is None:
            raise KeyError(f"Local model not found: {alias}")

        tensor = torch.tensor(inputs, dtype=torch.float32)
        if tensor.dim() == 3:
            tensor = tensor.unsqueeze(0)

        with torch.no_grad():
            logits = record.model(tensor)

        if record.task_type == "classification":
            probs = torch.softmax(logits, dim=1)
            pred = torch.argmax(probs, dim=1)
            return {
                "taskType": "classification",
                "predictions": pred.tolist(),
                "probabilities": probs.tolist(),
            }

        masks = torch.argmax(logits, dim=1)
        return {
            "taskType": "segmentation",
            "maskShape": list(masks.shape),
            "masks": masks.tolist(),
        }


serving_manager = ModelServingManager()
