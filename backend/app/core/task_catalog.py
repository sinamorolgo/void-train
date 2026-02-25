from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

from app.core.settings import get_settings
from app.core.train_config import TaskType

RunnerStartMethod = Literal["python_script", "python_module"]
MlflowMode = Literal["max", "min"]

DEFAULT_CATALOG: dict[str, Any] = {
    "tasks": [
        {
            "taskType": "classification",
            "enabled": True,
            "title": "Classification",
            "description": "Image classification trainer",
            "baseTaskType": "classification",
            "runner": {
                "startMethod": "python_script",
                "target": "backend/trainers/train_classification.py",
                "targetEnvVar": "CLASSIFICATION_SCRIPT_PATH",
            },
            "mlflow": {
                "metric": "val_accuracy",
                "mode": "max",
                "modelName": "classification-best-model",
                "artifactPath": "model",
            },
            "fieldOrder": [
                "run_name",
                "dataset_root",
                "output_root",
                "checkpoint_dir",
                "tensorboard_dir",
                "epochs",
                "batch_size",
                "learning_rate",
                "num_workers",
                "seed",
                "gpu_ids",
                "use_amp",
                "force_cpu",
                "save_every",
                "model_name",
                "num_classes",
                "image_size",
                "steps_per_epoch",
                "mlflow_tracking_uri",
                "mlflow_experiment",
            ],
            "fieldOverrides": {
                "run_name": {"default": "clf-quick-run"},
                "model_name": {"default": "tiny-cnn"},
            },
        },
        {
            "taskType": "segmentation",
            "enabled": True,
            "title": "Segmentation",
            "description": "Semantic segmentation trainer",
            "baseTaskType": "segmentation",
            "runner": {
                "startMethod": "python_script",
                "target": "backend/trainers/train_segmentation.py",
                "targetEnvVar": "SEGMENTATION_SCRIPT_PATH",
            },
            "mlflow": {
                "metric": "val_iou",
                "mode": "max",
                "modelName": "segmentation-best-model",
                "artifactPath": "model",
            },
            "fieldOrder": [
                "run_name",
                "dataset_root",
                "output_root",
                "checkpoint_dir",
                "tensorboard_dir",
                "epochs",
                "batch_size",
                "learning_rate",
                "num_workers",
                "seed",
                "gpu_ids",
                "use_amp",
                "force_cpu",
                "save_every",
                "encoder_name",
                "num_classes",
                "input_height",
                "input_width",
                "dice_weight",
                "ce_weight",
                "steps_per_epoch",
                "mlflow_tracking_uri",
                "mlflow_experiment",
            ],
            "fieldOverrides": {
                "run_name": {"default": "seg-quick-run"},
                "encoder_name": {"default": "tiny-unet-like"},
            },
        },
    ]
}


def _to_str(value: Any, *, field_name: str) -> str:
    if isinstance(value, str) and value.strip():
        return os.path.expandvars(value.strip())
    raise ValueError(f"Invalid value for {field_name}: {value!r}")


def _to_bool(value: Any, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    raise ValueError(f"Invalid boolean value: {value!r}")


def _to_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


@dataclass(frozen=True)
class RunnerConfig:
    start_method: RunnerStartMethod
    target: str
    target_env_var: str | None = None
    cwd: str | None = None

    def resolve_target(self) -> str:
        if self.target_env_var:
            env_value = os.getenv(self.target_env_var, "").strip()
            if env_value:
                return env_value
        return self.target


@dataclass(frozen=True)
class MlflowDefaults:
    metric: str
    mode: MlflowMode
    model_name: str
    artifact_path: str


@dataclass(frozen=True)
class TaskDefinition:
    task_type: str
    enabled: bool
    title: str
    description: str
    base_task_type: TaskType
    runner: RunnerConfig
    mlflow: MlflowDefaults
    field_order: list[str]
    hidden_fields: set[str]
    field_overrides: dict[str, dict[str, Any]]

    def default_field_values(self) -> dict[str, Any]:
        defaults: dict[str, Any] = {}
        for field_name, patch in self.field_overrides.items():
            if isinstance(patch, dict) and "default" in patch:
                defaults[field_name] = patch["default"]
        return defaults


class TaskCatalog:
    def __init__(self, tasks: list[TaskDefinition]) -> None:
        self._tasks = [task for task in tasks if task.enabled]
        self._task_map = {task.task_type: task for task in self._tasks}

    def list_tasks(self) -> list[TaskDefinition]:
        return list(self._tasks)

    def get_task(self, task_type: str) -> TaskDefinition:
        task = self._task_map.get(task_type)
        if task is None:
            known = ", ".join(sorted(self._task_map))
            raise KeyError(f"Unknown taskType: {task_type}. configured=[{known}]")
        return task


def _parse_task(raw: dict[str, Any]) -> TaskDefinition:
    task_type = _to_str(raw.get("taskType"), field_name="taskType")
    title = _to_str(raw.get("title", task_type), field_name=f"{task_type}.title")
    description = str(raw.get("description", "")).strip()
    enabled = _to_bool(raw.get("enabled"), default=True)

    base_task = _to_str(raw.get("baseTaskType", task_type), field_name=f"{task_type}.baseTaskType")
    if base_task not in {"classification", "segmentation"}:
        raise ValueError(f"Unsupported baseTaskType for {task_type}: {base_task}")

    runner_raw = _to_dict(raw.get("runner"))
    start_method = str(runner_raw.get("startMethod", "python_script")).strip()
    if start_method not in {"python_script", "python_module"}:
        raise ValueError(f"Unsupported runner.startMethod for {task_type}: {start_method}")

    runner = RunnerConfig(
        start_method=start_method,  # type: ignore[arg-type]
        target=_to_str(runner_raw.get("target"), field_name=f"{task_type}.runner.target"),
        target_env_var=str(runner_raw.get("targetEnvVar", "")).strip() or None,
        cwd=str(runner_raw.get("cwd", "")).strip() or None,
    )

    mlflow_raw = _to_dict(raw.get("mlflow"))
    mlflow_mode = str(mlflow_raw.get("mode", "max")).strip()
    if mlflow_mode not in {"max", "min"}:
        raise ValueError(f"Unsupported mlflow.mode for {task_type}: {mlflow_mode}")
    mlflow = MlflowDefaults(
        metric=_to_str(mlflow_raw.get("metric", "val_accuracy"), field_name=f"{task_type}.mlflow.metric"),
        mode=mlflow_mode,  # type: ignore[arg-type]
        model_name=_to_str(
            mlflow_raw.get("modelName", f"{task_type}-best-model"),
            field_name=f"{task_type}.mlflow.modelName",
        ),
        artifact_path=_to_str(mlflow_raw.get("artifactPath", "model"), field_name=f"{task_type}.mlflow.artifactPath"),
    )

    field_order = raw.get("fieldOrder", [])
    if not isinstance(field_order, list):
        raise ValueError(f"{task_type}.fieldOrder must be a list")
    normalized_field_order = [str(item).strip() for item in field_order if str(item).strip()]

    hidden_fields = raw.get("hiddenFields", [])
    if not isinstance(hidden_fields, list):
        raise ValueError(f"{task_type}.hiddenFields must be a list")
    normalized_hidden_fields = {str(item).strip() for item in hidden_fields if str(item).strip()}

    raw_overrides = raw.get("fieldOverrides", {})
    if not isinstance(raw_overrides, dict):
        raise ValueError(f"{task_type}.fieldOverrides must be an object")
    normalized_overrides: dict[str, dict[str, Any]] = {}
    for key, value in raw_overrides.items():
        if isinstance(value, dict):
            normalized_overrides[str(key)] = dict(value)

    return TaskDefinition(
        task_type=task_type,
        enabled=enabled,
        title=title,
        description=description,
        base_task_type=base_task,  # type: ignore[arg-type]
        runner=runner,
        mlflow=mlflow,
        field_order=normalized_field_order,
        hidden_fields=normalized_hidden_fields,
        field_overrides=normalized_overrides,
    )


def _read_catalog(path: Path) -> dict[str, Any]:
    if not path.exists():
        return DEFAULT_CATALOG

    with path.open("r", encoding="utf-8") as stream:
        loaded = yaml.safe_load(stream) or {}
    if not isinstance(loaded, dict):
        raise ValueError(f"Invalid catalog format: {path}")
    return loaded


class TaskCatalogService:
    def __init__(self, catalog_path: Path) -> None:
        self._catalog_path = catalog_path

    def load(self) -> TaskCatalog:
        payload = _read_catalog(self._catalog_path)
        tasks_raw = payload.get("tasks", [])
        if not isinstance(tasks_raw, list):
            raise ValueError(f"Invalid catalog format. 'tasks' must be a list: {self._catalog_path}")

        tasks = [_parse_task(item) for item in tasks_raw if isinstance(item, dict)]
        if not tasks:
            raise ValueError(f"No tasks configured in catalog: {self._catalog_path}")
        return TaskCatalog(tasks)


@lru_cache(maxsize=1)
def get_task_catalog() -> TaskCatalog:
    settings = get_settings()
    service = TaskCatalogService(settings.training_catalog_path)
    return service.load()

