from __future__ import annotations

import copy
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

from app.core.catalog_repository import get_catalog_repository
from app.core.settings import get_settings
from app.core.train_config import TaskType, dataclass_schema, parse_bool

RunnerStartMethod = Literal["python_script", "python_module"]
MlflowMode = Literal["max", "min"]
RegistryStage = Literal["dev", "release"]
ExtraFieldValueType = Literal["str", "int", "float", "bool"]
FieldInputType = Literal["text", "number", "boolean", "select"]

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
    ],
    "registryModels": [
        {
            "id": "classification",
            "title": "Classification Model",
            "description": "Primary checkpoint family for classification inference/download flows.",
            "taskType": "classification",
            "modelName": "classification-best-model",
            "defaultStage": "release",
            "defaultVersion": "latest",
            "defaultDestinationDir": "./backend/artifacts/downloads",
        },
        {
            "id": "segmentation",
            "title": "Segmentation Model",
            "description": "Primary checkpoint family for segmentation inference/download flows.",
            "taskType": "segmentation",
            "modelName": "segmentation-best-model",
            "defaultStage": "release",
            "defaultVersion": "latest",
            "defaultDestinationDir": "./backend/artifacts/downloads",
        },
    ],
}


def default_catalog_payload() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT_CATALOG)


def render_catalog_yaml(payload: dict[str, Any]) -> str:
    return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)


def parse_catalog_yaml(content: str, *, source: str) -> dict[str, Any]:
    loaded = yaml.safe_load(content) or {}
    if not isinstance(loaded, dict):
        raise ValueError(f"Invalid catalog format: {source}")
    return loaded


def read_catalog_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        return default_catalog_payload()
    return parse_catalog_yaml(path.read_text(encoding="utf-8"), source=str(path))


def read_catalog_text(path: Path) -> tuple[str, bool]:
    if path.exists():
        return path.read_text(encoding="utf-8"), True
    return render_catalog_yaml(default_catalog_payload()), False


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


def _normalize_registry_id(value: str, *, fallback: str) -> str:
    candidate = value.strip().lower().replace(" ", "-")
    candidate = re.sub(r"[^a-z0-9_-]", "", candidate)
    candidate = candidate.strip("-_")
    return candidate or fallback


def _to_registry_stage(value: Any, *, default: RegistryStage, field_name: str) -> RegistryStage:
    if value is None:
        return default
    stage = str(value).strip().lower()
    if stage in {"dev", "release"}:
        return stage  # type: ignore[return-value]
    raise ValueError(f"Invalid value for {field_name}: {value!r}")


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
class ExtraFieldDefinition:
    name: str
    value_type: ExtraFieldValueType
    input_type: FieldInputType
    required: bool = False
    default: Any | None = None
    label: str | None = None
    description: str = ""
    group: str = "custom"
    choices: list[str] | None = None
    min_value: float | int | None = None
    max_value: float | int | None = None
    step: float | int | None = None
    cli_arg: str | None = None
    pass_when_empty: bool = False

    def cli_flag(self) -> str:
        if self.cli_arg:
            return self.cli_arg if self.cli_arg.startswith("--") else f"--{self.cli_arg.lstrip('-')}"
        return f"--{self.name.replace('_', '-')}"

    def to_schema_field(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "type": self.input_type,
            "valueType": self.value_type,
            "required": self.required,
            "default": self.default,
            "label": self.label or self.name,
            "description": self.description,
            "group": self.group,
            "choices": list(self.choices or []),
            "min": self.min_value,
            "max": self.max_value,
            "step": self.step,
            "cliArg": self.cli_flag(),
            "isExtra": True,
        }


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
    extra_fields: list[ExtraFieldDefinition]

    def default_field_values(self) -> dict[str, Any]:
        defaults: dict[str, Any] = {}
        for field_name, patch in self.field_overrides.items():
            if isinstance(patch, dict) and "default" in patch:
                defaults[field_name] = patch["default"]
        for field in self.extra_fields:
            if field.default is not None:
                defaults[field.name] = field.default
        return defaults


@dataclass(frozen=True)
class RegistryModelDefinition:
    model_id: str
    title: str
    description: str
    task_type: TaskType
    model_name: str
    default_stage: RegistryStage
    default_version: str
    default_destination_dir: str


def _coerce_extra_field_value(*, value: Any, value_type: ExtraFieldValueType, field_name: str) -> Any:
    if value is None:
        return None
    if value_type == "str":
        return str(value)
    if value_type == "int":
        try:
            return int(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"Invalid int value for {field_name}: {value!r}") from error
    if value_type == "float":
        try:
            return float(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"Invalid float value for {field_name}: {value!r}") from error
    if value_type == "bool":
        try:
            return parse_bool(value)
        except ValueError as error:
            raise ValueError(f"Invalid bool value for {field_name}: {value!r}") from error
    return value


def _parse_extra_field_value_type(value: Any, *, field_name: str) -> ExtraFieldValueType:
    raw = str(value or "str").strip().lower()
    normalized = {
        "string": "str",
        "text": "str",
        "int": "int",
        "integer": "int",
        "float": "float",
        "double": "float",
        "number": "float",
        "bool": "bool",
        "boolean": "bool",
    }.get(raw, raw)
    if normalized in {"str", "int", "float", "bool"}:
        return normalized  # type: ignore[return-value]
    raise ValueError(f"Invalid valueType for {field_name}: {value!r}")


def _parse_extra_field_input_type(
    value: Any,
    *,
    value_type: ExtraFieldValueType,
    has_choices: bool,
    field_name: str,
) -> FieldInputType:
    if value is None or str(value).strip() == "":
        if has_choices:
            return "select"
        if value_type == "bool":
            return "boolean"
        if value_type in {"int", "float"}:
            return "number"
        return "text"

    input_type = str(value).strip().lower()
    if input_type not in {"text", "number", "boolean", "select"}:
        raise ValueError(f"Invalid type for {field_name}: {value!r}")
    if input_type == "boolean" and value_type != "bool":
        raise ValueError(f"{field_name}: type='boolean' requires valueType='bool'")
    if input_type == "select" and not has_choices:
        raise ValueError(f"{field_name}: type='select' requires non-empty choices")
    return input_type  # type: ignore[return-value]


def _parse_optional_number(value: Any, *, field_name: str) -> float | int | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"Invalid number for {field_name}: {value!r}") from error


def _parse_extra_fields(
    raw_task: dict[str, Any],
    *,
    task_type: str,
    base_task_type: TaskType,
) -> list[ExtraFieldDefinition]:
    raw_extra = raw_task.get("extraFields", [])
    if raw_extra is None:
        return []
    if not isinstance(raw_extra, list):
        raise ValueError(f"{task_type}.extraFields must be a list")

    base_field_names = {field["name"] for field in dataclass_schema(base_task_type)["fields"]}
    seen_names: set[str] = set()
    parsed: list[ExtraFieldDefinition] = []

    for index, entry in enumerate(raw_extra):
        field_prefix = f"{task_type}.extraFields[{index}]"
        if not isinstance(entry, dict):
            raise ValueError(f"{field_prefix} must be an object")

        name = str(entry.get("name", "")).strip()
        if not name:
            raise ValueError(f"{field_prefix}.name is required")
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name):
            raise ValueError(f"{field_prefix}.name must match ^[A-Za-z_][A-Za-z0-9_]*$")
        if name in seen_names:
            raise ValueError(f"Duplicate extra field name in {task_type}: {name}")
        if name in base_field_names:
            raise ValueError(f"{field_prefix}.name conflicts with base config field: {name}")
        seen_names.add(name)

        value_type = _parse_extra_field_value_type(entry.get("valueType", "str"), field_name=f"{field_prefix}.valueType")

        choices_raw = entry.get("choices")
        choices: list[str] = []
        if choices_raw is not None:
            if not isinstance(choices_raw, list):
                raise ValueError(f"{field_prefix}.choices must be a list")
            choices = [str(choice).strip() for choice in choices_raw if str(choice).strip()]

        input_type = _parse_extra_field_input_type(
            entry.get("type"),
            value_type=value_type,
            has_choices=bool(choices),
            field_name=f"{field_prefix}.type",
        )

        required = _to_bool(entry.get("required"), default=False)
        default_value: Any | None = None
        if "default" in entry:
            raw_default = entry.get("default")
            if isinstance(raw_default, str) and not raw_default.strip() and value_type != "str":
                raw_default = None
            default_value = _coerce_extra_field_value(
                value=raw_default,
                value_type=value_type,
                field_name=f"{field_prefix}.default",
            )
            if choices and default_value is not None and str(default_value) not in choices:
                raise ValueError(f"{field_prefix}.default must be one of choices")

        cli_arg_raw = str(entry.get("cliArg", "")).strip()
        cli_arg = None
        if cli_arg_raw:
            cli_arg = cli_arg_raw if cli_arg_raw.startswith("--") else f"--{cli_arg_raw.lstrip('-')}"

        pass_when_empty = _to_bool(entry.get("passWhenEmpty"), default=False)
        if pass_when_empty and value_type != "str":
            raise ValueError(f"{field_prefix}.passWhenEmpty is only supported when valueType='str'")
        if choices and value_type != "str":
            raise ValueError(f"{field_prefix}.choices is only supported when valueType='str'")

        parsed.append(
            ExtraFieldDefinition(
                name=name,
                value_type=value_type,
                input_type=input_type,
                required=required,
                default=default_value,
                label=str(entry.get("label", "")).strip() or name,
                description=str(entry.get("description", "")).strip(),
                group=str(entry.get("group", "custom")).strip() or "custom",
                choices=choices or None,
                min_value=_parse_optional_number(entry.get("min"), field_name=f"{field_prefix}.min"),
                max_value=_parse_optional_number(entry.get("max"), field_name=f"{field_prefix}.max"),
                step=_parse_optional_number(entry.get("step"), field_name=f"{field_prefix}.step"),
                cli_arg=cli_arg,
                pass_when_empty=pass_when_empty,
            )
        )

    return parsed


class TaskCatalog:
    def __init__(self, tasks: list[TaskDefinition], registry_models: list[RegistryModelDefinition]) -> None:
        self._tasks = [task for task in tasks if task.enabled]
        self._task_map = {task.task_type: task for task in self._tasks}
        self._registry_models = list(registry_models)
        self._registry_model_map = {item.model_id: item for item in self._registry_models}

    def list_tasks(self) -> list[TaskDefinition]:
        return list(self._tasks)

    def get_task(self, task_type: str) -> TaskDefinition:
        task = self._task_map.get(task_type)
        if task is None:
            known = ", ".join(sorted(self._task_map))
            raise KeyError(f"Unknown taskType: {task_type}. configured=[{known}]")
        return task

    def list_registry_models(self) -> list[RegistryModelDefinition]:
        return list(self._registry_models)

    def get_registry_model(self, model_id: str) -> RegistryModelDefinition:
        item = self._registry_model_map.get(model_id)
        if item is None:
            known = ", ".join(sorted(self._registry_model_map))
            raise KeyError(f"Unknown registry model id: {model_id}. configured=[{known}]")
        return item


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
    extra_fields = _parse_extra_fields(
        raw,
        task_type=task_type,
        base_task_type=base_task,  # type: ignore[arg-type]
    )

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
        extra_fields=extra_fields,
    )


def _parse_registry_model(raw: dict[str, Any], *, fallback_id: str, source: str) -> RegistryModelDefinition:
    model_name = _to_str(raw.get("modelName"), field_name=f"{source}.modelName")

    task_type = _to_str(raw.get("taskType", "classification"), field_name=f"{source}.taskType")
    if task_type not in {"classification", "segmentation"}:
        raise ValueError(f"Unsupported taskType for {source}: {task_type}")

    model_id = _normalize_registry_id(
        str(raw.get("id", "") or model_name),
        fallback=fallback_id,
    )
    title = str(raw.get("title", "")).strip() or model_name
    description = str(raw.get("description", "")).strip()
    default_stage = _to_registry_stage(
        raw.get("defaultStage"),
        default="release",
        field_name=f"{source}.defaultStage",
    )
    default_version = str(raw.get("defaultVersion", "latest")).strip() or "latest"
    default_destination_dir = str(
        raw.get("defaultDestinationDir", "./backend/artifacts/downloads")
    ).strip() or "./backend/artifacts/downloads"

    return RegistryModelDefinition(
        model_id=model_id,
        title=title,
        description=description,
        task_type=task_type,  # type: ignore[arg-type]
        model_name=model_name,
        default_stage=default_stage,
        default_version=default_version,
        default_destination_dir=os.path.expandvars(default_destination_dir),
    )


def _derive_registry_models_from_tasks(tasks: list[TaskDefinition]) -> list[RegistryModelDefinition]:
    items: list[RegistryModelDefinition] = []
    seen_ids: set[str] = set()

    for task in tasks:
        base_id = _normalize_registry_id(task.task_type, fallback="model")
        candidate_id = base_id
        suffix = 2
        while candidate_id in seen_ids:
            candidate_id = f"{base_id}-{suffix}"
            suffix += 1
        seen_ids.add(candidate_id)

        items.append(
            RegistryModelDefinition(
                model_id=candidate_id,
                title=f"{task.title} Model",
                description=f"Configured from task '{task.task_type}'",
                task_type=task.base_task_type,
                model_name=task.mlflow.model_name,
                default_stage="release",
                default_version="latest",
                default_destination_dir="./backend/artifacts/downloads",
            )
        )

    return items


def _parse_task_definitions(tasks_raw: Any, *, source: str) -> list[TaskDefinition]:
    if not isinstance(tasks_raw, list):
        raise ValueError(f"Invalid catalog format. 'tasks' must be a list: {source}")

    tasks = [_parse_task(item) for item in tasks_raw if isinstance(item, dict)]
    if not tasks:
        raise ValueError(f"No tasks configured in catalog: {source}")
    return tasks


def _find_duplicate_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    duplicated: set[str] = set()
    for value in values:
        if value in seen:
            duplicated.add(value)
        seen.add(value)
    return sorted(duplicated)


def _raise_if_duplicate_task_types(tasks: list[TaskDefinition]) -> None:
    duplicated = _find_duplicate_values([task.task_type for task in tasks])
    if duplicated:
        raise ValueError(f"Duplicate taskType detected in catalog: {', '.join(duplicated)}")


def _parse_registry_models(
    registry_raw: Any,
    *,
    tasks: list[TaskDefinition],
    source: str,
) -> list[RegistryModelDefinition]:
    if registry_raw is None:
        return _derive_registry_models_from_tasks(tasks)

    if not isinstance(registry_raw, list):
        raise ValueError(f"Invalid catalog format. 'registryModels' must be a list: {source}")

    registry_models: list[RegistryModelDefinition] = []
    seen_ids: set[str] = set()
    for index, item in enumerate(registry_raw):
        if not isinstance(item, dict):
            raise ValueError(f"Invalid registry model at index={index}: expected object")
        parsed = _parse_registry_model(item, fallback_id=f"model-{index + 1}", source=f"registryModels[{index}]")
        if parsed.model_id in seen_ids:
            raise ValueError(f"Duplicate registry model id: {parsed.model_id}")
        seen_ids.add(parsed.model_id)
        registry_models.append(parsed)

    if not registry_models:
        return _derive_registry_models_from_tasks(tasks)
    return registry_models


def validate_catalog_payload(payload: dict[str, Any], *, source: str) -> TaskCatalog:
    tasks = _parse_task_definitions(payload.get("tasks", []), source=source)
    _raise_if_duplicate_task_types(tasks)
    registry_models = _parse_registry_models(payload.get("registryModels"), tasks=tasks, source=source)

    return TaskCatalog(tasks, registry_models)


class TaskCatalogService:
    def __init__(self, catalog_path: Path) -> None:
        self._catalog_path = catalog_path

    def load(self) -> TaskCatalog:
        payload = read_catalog_payload(self._catalog_path)
        return validate_catalog_payload(payload, source=str(self._catalog_path))


@lru_cache(maxsize=1)
def get_task_catalog() -> TaskCatalog:
    settings = get_settings()
    repository = get_catalog_repository()
    revision = repository.seed_if_empty(
        seed_file_path=settings.training_catalog_path,
        default_content=render_catalog_yaml(default_catalog_payload()),
    )
    payload = parse_catalog_yaml(
        revision.content,
        source=f"training_catalog_revisions:{revision.revision_id}",
    )
    return validate_catalog_payload(
        payload,
        source=f"training_catalog_revisions:{revision.revision_id}",
    )
