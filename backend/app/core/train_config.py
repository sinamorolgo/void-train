from __future__ import annotations

import argparse
from dataclasses import MISSING, asdict, dataclass, field, fields
from pathlib import Path
from types import UnionType
from typing import Any, Literal, Type, TypeVar, Union, get_args, get_origin, get_type_hints

TaskType = Literal["classification", "segmentation"]

T = TypeVar("T")

PROGRESS_PREFIX = "VTM_PROGRESS::"
RUN_META_PREFIX = "VTM_RUN_META::"


def ui_meta(
    label: str,
    description: str,
    *,
    group: str,
    required: bool = False,
    choices: list[str] | None = None,
    min_value: float | int | None = None,
    max_value: float | int | None = None,
    step: float | int | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "label": label,
        "description": description,
        "group": group,
        "required": required,
    }
    if choices:
        data["choices"] = choices
    if min_value is not None:
        data["min"] = min_value
    if max_value is not None:
        data["max"] = max_value
    if step is not None:
        data["step"] = step
    return data


@dataclass
class BaseTrainConfig:
    run_name: str = field(
        default="quick-run",
        metadata=ui_meta(
            "Run Name",
            "MLflow/TensorBoard에 표시될 실행 이름",
            group="identity",
            required=True,
        ),
    )
    dataset_root: str = field(
        default="./datasets",
        metadata=ui_meta(
            "Dataset Root",
            "학습 데이터 루트 경로",
            group="paths",
            required=True,
        ),
    )
    output_root: str = field(
        default="./outputs",
        metadata=ui_meta(
            "Output Root",
            "체크포인트/로그 저장 루트",
            group="paths",
            required=True,
        ),
    )
    checkpoint_dir: str = field(
        default="./outputs/checkpoints",
        metadata=ui_meta(
            "Checkpoint Dir",
            "에폭별 체크포인트 저장 경로",
            group="paths",
            required=True,
        ),
    )
    tensorboard_dir: str = field(
        default="./outputs/tensorboard",
        metadata=ui_meta(
            "TensorBoard Dir",
            "TensorBoard 이벤트 저장 경로",
            group="paths",
            required=True,
        ),
    )
    epochs: int = field(
        default=3,
        metadata=ui_meta(
            "Epochs",
            "총 학습 에폭 수",
            group="training",
            min_value=1,
            max_value=10000,
            step=1,
        ),
    )
    batch_size: int = field(
        default=8,
        metadata=ui_meta(
            "Batch Size",
            "미니배치 크기",
            group="training",
            min_value=1,
            max_value=4096,
            step=1,
        ),
    )
    learning_rate: float = field(
        default=1e-3,
        metadata=ui_meta(
            "Learning Rate",
            "초기 학습률",
            group="training",
            min_value=1e-7,
            max_value=10,
            step=1e-4,
        ),
    )
    num_workers: int = field(
        default=2,
        metadata=ui_meta(
            "Num Workers",
            "데이터 로더 워커 수",
            group="training",
            min_value=0,
            max_value=64,
            step=1,
        ),
    )
    seed: int = field(
        default=42,
        metadata=ui_meta(
            "Seed",
            "재현성 시드",
            group="training",
            min_value=0,
            max_value=2_147_483_647,
            step=1,
        ),
    )
    gpu_ids: str = field(
        default="0",
        metadata=ui_meta(
            "GPU IDs",
            "사용할 GPU 번호(쉼표 구분, 예: 0 또는 0,1)",
            group="runtime",
            required=True,
        ),
    )
    use_amp: bool = field(
        default=False,
        metadata=ui_meta(
            "Use AMP",
            "혼합 정밀도 학습 사용 여부",
            group="runtime",
        ),
    )
    force_cpu: bool = field(
        default=False,
        metadata=ui_meta(
            "Force CPU",
            "GPU가 있어도 CPU로 강제 실행",
            group="runtime",
        ),
    )
    save_every: int = field(
        default=1,
        metadata=ui_meta(
            "Save Every",
            "몇 에폭마다 체크포인트를 저장할지",
            group="runtime",
            min_value=1,
            max_value=10000,
            step=1,
        ),
    )
    mlflow_tracking_uri: str = field(
        default="http://127.0.0.1:5001",
        metadata=ui_meta(
            "MLflow Tracking URI",
            "MLflow tracking server 주소",
            group="mlflow",
            required=True,
        ),
    )
    mlflow_experiment: str = field(
        default="void-train-manager",
        metadata=ui_meta(
            "MLflow Experiment",
            "MLflow experiment 이름",
            group="mlflow",
            required=True,
        ),
    )


@dataclass
class ClassificationTrainConfig(BaseTrainConfig):
    model_name: str = field(
        default="tiny-cnn",
        metadata=ui_meta(
            "Model Name",
            "분류 모델 이름",
            group="task",
            choices=["tiny-cnn"],
        ),
    )
    num_classes: int = field(
        default=5,
        metadata=ui_meta(
            "Num Classes",
            "클래스 개수",
            group="task",
            min_value=2,
            max_value=10000,
            step=1,
        ),
    )
    image_size: int = field(
        default=64,
        metadata=ui_meta(
            "Image Size",
            "입력 이미지 한 변 길이",
            group="task",
            min_value=16,
            max_value=1024,
            step=1,
        ),
    )
    steps_per_epoch: int = field(
        default=10,
        metadata=ui_meta(
            "Steps / Epoch",
            "에폭당 스텝 수(데모에서는 synthetic batch 수)",
            group="task",
            min_value=1,
            max_value=10000,
            step=1,
        ),
    )


@dataclass
class SegmentationTrainConfig(BaseTrainConfig):
    encoder_name: str = field(
        default="tiny-unet-like",
        metadata=ui_meta(
            "Encoder",
            "세그멘테이션 백본 이름",
            group="task",
            choices=["tiny-unet-like"],
        ),
    )
    num_classes: int = field(
        default=2,
        metadata=ui_meta(
            "Num Classes",
            "세그멘테이션 클래스 수",
            group="task",
            min_value=2,
            max_value=512,
            step=1,
        ),
    )
    input_height: int = field(
        default=64,
        metadata=ui_meta(
            "Input Height",
            "입력 높이",
            group="task",
            min_value=16,
            max_value=1024,
            step=1,
        ),
    )
    input_width: int = field(
        default=64,
        metadata=ui_meta(
            "Input Width",
            "입력 너비",
            group="task",
            min_value=16,
            max_value=1024,
            step=1,
        ),
    )
    dice_weight: float = field(
        default=0.7,
        metadata=ui_meta(
            "Dice Weight",
            "Dice loss 가중치",
            group="task",
            min_value=0.0,
            max_value=1.0,
            step=0.05,
        ),
    )
    ce_weight: float = field(
        default=0.3,
        metadata=ui_meta(
            "CE Weight",
            "Cross entropy loss 가중치",
            group="task",
            min_value=0.0,
            max_value=1.0,
            step=0.05,
        ),
    )
    steps_per_epoch: int = field(
        default=8,
        metadata=ui_meta(
            "Steps / Epoch",
            "에폭당 스텝 수(데모에서는 synthetic batch 수)",
            group="task",
            min_value=1,
            max_value=10000,
            step=1,
        ),
    )


TASK_CONFIG_CLASSES: dict[TaskType, Type[BaseTrainConfig]] = {
    "classification": ClassificationTrainConfig,
    "segmentation": SegmentationTrainConfig,
}


def _is_optional(field_type: Any) -> bool:
    origin = get_origin(field_type)
    if origin in {UnionType, Union}:
        return type(None) in get_args(field_type)
    return False


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def _coerce_value(field_type: Any, raw_value: Any) -> Any:
    if raw_value is None:
        return None

    origin = get_origin(field_type)
    if origin is Literal:
        literal_values = get_args(field_type)
        if raw_value in literal_values:
            return raw_value
        raise ValueError(f"Expected one of {literal_values}, got {raw_value}")

    if field_type is bool:
        return parse_bool(raw_value)
    if field_type is int:
        return int(raw_value)
    if field_type is float:
        return float(raw_value)
    if field_type is str:
        return str(raw_value)

    return raw_value


def build_config(task_type: TaskType, raw_values: dict[str, Any]) -> BaseTrainConfig:
    config_cls = TASK_CONFIG_CLASSES[task_type]
    type_hints = get_type_hints(config_cls)
    init_values: dict[str, Any] = {}

    for item in fields(config_cls):
        resolved_type = type_hints.get(item.name, item.type)
        if item.name in raw_values:
            init_values[item.name] = _coerce_value(resolved_type, raw_values[item.name])
            continue

        if item.default is not MISSING:
            init_values[item.name] = item.default
            continue

        if item.default_factory is not MISSING:  # type: ignore[comparison-overlap]
            init_values[item.name] = item.default_factory()  # type: ignore[misc]
            continue

        if _is_optional(resolved_type):
            init_values[item.name] = None
            continue

        raise ValueError(f"Missing required field: {item.name}")

    return config_cls(**init_values)


def config_to_dict(config: BaseTrainConfig) -> dict[str, Any]:
    data = asdict(config)
    return {key: str(value) if isinstance(value, Path) else value for key, value in data.items()}


def dataclass_schema(task_type: TaskType) -> dict[str, Any]:
    config_cls = TASK_CONFIG_CLASSES[task_type]
    type_hints = get_type_hints(config_cls)
    result_fields: list[dict[str, Any]] = []

    for item in fields(config_cls):
        metadata = dict(item.metadata)
        required = metadata.get("required", False) or item.default is MISSING
        choices = metadata.get("choices")
        resolved_type = type_hints.get(item.name, item.type)

        input_type = "text"
        if choices:
            input_type = "select"
        elif resolved_type in {int, float}:
            input_type = "number"
        elif resolved_type is bool:
            input_type = "boolean"

        default_value = None if item.default is MISSING else item.default

        result_fields.append(
            {
                "name": item.name,
                "type": input_type,
                "valueType": getattr(resolved_type, "__name__", str(resolved_type)),
                "required": required,
                "default": default_value,
                "label": metadata.get("label", item.name),
                "description": metadata.get("description", ""),
                "group": metadata.get("group", "general"),
                "choices": choices,
                "min": metadata.get("min"),
                "max": metadata.get("max"),
                "step": metadata.get("step"),
            }
        )

    return {
        "taskType": task_type,
        "title": "Classification" if task_type == "classification" else "Segmentation",
        "fields": result_fields,
    }


def build_arg_parser(config_cls: Type[T]) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    type_hints = get_type_hints(config_cls)

    for item in fields(config_cls):
        resolved_type = type_hints.get(item.name, item.type)
        arg_name = f"--{item.name.replace('_', '-')}"
        kwargs: dict[str, Any] = {"help": item.metadata.get("description", "")}

        if resolved_type is bool:
            kwargs["type"] = parse_bool
        elif resolved_type is int:
            kwargs["type"] = int
        elif resolved_type is float:
            kwargs["type"] = float
        else:
            kwargs["type"] = str

        if item.default is not MISSING:
            kwargs["default"] = item.default
        else:
            kwargs["required"] = True

        parser.add_argument(arg_name, dest=item.name, **kwargs)

    return parser


def config_to_cli_args(config: BaseTrainConfig) -> list[str]:
    cli_args: list[str] = []
    for key, value in config_to_dict(config).items():
        cli_args.append(f"--{key.replace('_', '-')}")
        if isinstance(value, bool):
            cli_args.append("true" if value else "false")
        else:
            cli_args.append(str(value))
    return cli_args


def get_metric_for_task(task_type: TaskType) -> str:
    if task_type == "classification":
        return "val_accuracy"
    return "val_iou"
