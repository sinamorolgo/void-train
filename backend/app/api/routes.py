from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, cast

from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    DownloadFromFtpRequest,
    DownloadFromMlflowRequest,
    LoadLocalModelRequest,
    MigrateTensorBoardRequest,
    PromoteFtpModelRequest,
    PublishFtpModelRequest,
    PredictRequest,
    SaveCatalogRequest,
    SelectBestRequest,
    StartFtpServerRequest,
    StartMlflowServingRequest,
    StartRunRequest,
    StopFtpServerRequest,
    StopMlflowServingRequest,
    ValidateCatalogRequest,
)
from app.core.task_catalog import (
    TaskDefinition,
    get_task_catalog,
    parse_catalog_yaml,
    read_catalog_text,
    render_catalog_yaml,
    validate_catalog_payload,
)
from app.core.settings import get_settings
from app.core.train_config import TaskType, dataclass_schema, get_metric_for_task
from app.services.ftp_model_registry import StageType, ftp_registry
from app.services.ftp_server_manager import ftp_server_manager
from app.services.ftp_service import download_file_via_ftp
from app.services.mlflow_service import (
    download_artifact,
    list_runs,
    register_model,
    select_best_run,
)
from app.services.model_serving import serving_manager
from app.services.run_manager import run_manager
from app.services.tb_migration import import_tensorboard_scalars

router = APIRouter(prefix="/api")
settings = get_settings()


def _raise_bad_request(error: Exception) -> None:
    raise HTTPException(status_code=400, detail=str(error)) from error


def _as_bad_request(handler: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    try:
        return handler()
    except Exception as error:  # noqa: BLE001
        _raise_bad_request(error)


def _validate_stage(stage: str) -> StageType:
    if stage not in {"dev", "release"}:
        raise HTTPException(status_code=400, detail="stage must be 'dev' or 'release'")
    return cast(StageType, stage)


def _task_definition(task_type: str) -> TaskDefinition:
    try:
        return get_task_catalog().get_task(task_type)
    except KeyError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def _build_task_schema(task: TaskDefinition) -> dict[str, Any]:
    schema = dataclass_schema(task.base_task_type)
    field_map = {field["name"]: dict(field) for field in schema["fields"]}

    for field_name, patch in task.field_overrides.items():
        if field_name not in field_map:
            continue
        field_data = field_map[field_name]
        for key in {"type", "required", "default", "label", "description", "group", "choices", "min", "max", "step"}:
            if key in patch:
                field_data[key] = patch[key]

    filtered_items = [
        field
        for name, field in field_map.items()
        if name not in task.hidden_fields
    ]

    order_index = {name: idx for idx, name in enumerate(task.field_order)}
    filtered_items.sort(key=lambda item: (order_index.get(item["name"], 10_000), item["name"]))

    return {
        "taskType": task.task_type,
        "baseTaskType": task.base_task_type,
        "title": task.title,
        "description": task.description,
        "runner": {
            "startMethod": task.runner.start_method,
            "target": task.runner.target,
            "targetEnvVar": task.runner.target_env_var,
        },
        "mlflow": {
            "metric": task.mlflow.metric,
            "mode": task.mlflow.mode,
            "modelName": task.mlflow.model_name,
            "artifactPath": task.mlflow.artifact_path,
        },
        "fields": filtered_items,
    }


def _task_summary(task: TaskDefinition) -> dict[str, Any]:
    return {
        "taskType": task.task_type,
        "title": task.title,
        "baseTaskType": task.base_task_type,
        "runnerTarget": task.runner.target,
        "runnerStartMethod": task.runner.start_method,
        "fieldOverrideCount": len(task.field_overrides),
        "fieldOrderCount": len(task.field_order),
    }


def _catalog_payload_response(*, content: str, exists: bool, source_path: Path) -> dict[str, Any]:
    parsed = parse_catalog_yaml(content, source=str(source_path))
    catalog = validate_catalog_payload(parsed, source=str(source_path))
    modified_at: str | None = None
    if exists:
        modified_at = datetime.fromtimestamp(source_path.stat().st_mtime, tz=timezone.utc).isoformat()
    return {
        "path": str(source_path),
        "exists": exists,
        "modifiedAt": modified_at,
        "content": content,
        "taskCount": len(catalog.list_tasks()),
        "tasks": [_task_summary(task) for task in catalog.list_tasks()],
    }


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "defaultMlflowTrackingUri": settings.default_mlflow_tracking_uri,
        "defaultMlflowExperiment": settings.default_mlflow_experiment,
        "trainingCatalogPath": str(settings.training_catalog_path),
    }


@router.get("/config-schemas")
def config_schemas() -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        catalog = get_task_catalog()
        return {"items": [_build_task_schema(task) for task in catalog.list_tasks()]}

    return _as_bad_request(_run)


@router.get("/catalog")
def get_catalog() -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        content, exists = read_catalog_text(settings.training_catalog_path)
        return _catalog_payload_response(content=content, exists=exists, source_path=settings.training_catalog_path)

    return _as_bad_request(_run)


@router.post("/catalog/validate")
def validate_catalog(payload: ValidateCatalogRequest) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        parsed = parse_catalog_yaml(payload.content, source="request.body.content")
        catalog = validate_catalog_payload(parsed, source="request.body.content")
        return {
            "valid": True,
            "taskCount": len(catalog.list_tasks()),
            "tasks": [_task_summary(task) for task in catalog.list_tasks()],
        }

    return _as_bad_request(_run)


@router.post("/catalog/format")
def format_catalog(payload: ValidateCatalogRequest) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        parsed = parse_catalog_yaml(payload.content, source="request.body.content")
        catalog = validate_catalog_payload(parsed, source="request.body.content")
        return {
            "valid": True,
            "taskCount": len(catalog.list_tasks()),
            "tasks": [_task_summary(task) for task in catalog.list_tasks()],
            "content": render_catalog_yaml(parsed),
        }

    return _as_bad_request(_run)


@router.post("/catalog/save")
def save_catalog(payload: SaveCatalogRequest) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        source_path = settings.training_catalog_path
        parsed = parse_catalog_yaml(payload.content, source="request.body.content")
        catalog = validate_catalog_payload(parsed, source="request.body.content")

        source_path.parent.mkdir(parents=True, exist_ok=True)
        backup_path: Path | None = None
        if payload.createBackup and source_path.exists():
            backup_stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup_path = source_path.with_suffix(f".{backup_stamp}.bak.yaml")
            backup_path.write_text(source_path.read_text(encoding="utf-8"), encoding="utf-8")

        source_path.write_text(render_catalog_yaml(parsed), encoding="utf-8")
        get_task_catalog.cache_clear()
        get_task_catalog()

        response = _catalog_payload_response(
            content=source_path.read_text(encoding="utf-8"),
            exists=True,
            source_path=source_path,
        )
        response["saved"] = True
        response["backupPath"] = str(backup_path) if backup_path else None
        response["taskCount"] = len(catalog.list_tasks())
        return response

    return _as_bad_request(_run)


@router.post("/runs/start")
def start_run(payload: StartRunRequest) -> dict[str, Any]:
    return _as_bad_request(lambda: run_manager.start_run(payload.taskType, payload.values))


@router.get("/runs")
def get_runs() -> dict[str, Any]:
    return {"items": run_manager.list_runs()}


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    run = run_manager.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    return run


@router.post("/runs/{run_id}/stop")
def stop_run(run_id: str) -> dict[str, Any]:
    try:
        return run_manager.stop_run(run_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/mlflow/runs")
def get_mlflow_runs(
    trackingUri: str | None = None,
    experimentName: str | None = None,
    taskType: str | None = None,
    limit: int = 30,
) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        resolved_task_type: TaskType | None = None
        if taskType:
            resolved_task_type = _task_definition(taskType).base_task_type

        runs = list_runs(
            tracking_uri=trackingUri or settings.default_mlflow_tracking_uri,
            experiment_name=experimentName or settings.default_mlflow_experiment,
            task_type=resolved_task_type,
            limit=limit,
        )
        return {"items": runs}

    return _as_bad_request(_run)


@router.post("/mlflow/select-best")
def pick_best_run(payload: SelectBestRequest) -> dict[str, Any]:
    task = _task_definition(payload.taskType)
    metric_name = payload.metric or task.mlflow.metric or get_metric_for_task(task.base_task_type)

    tracking_uri = settings.default_mlflow_tracking_uri
    experiment_name = payload.experimentName or settings.default_mlflow_experiment

    def _run() -> dict[str, Any]:
        best = select_best_run(
            tracking_uri=tracking_uri,
            experiment_name=experiment_name,
            metric_name=metric_name,
            mode=payload.mode or task.mlflow.mode,
            task_type=task.base_task_type,
        )

        response: dict[str, Any] = {
            "taskType": payload.taskType,
            "runId": best.run_id,
            "metric": best.metric_name,
            "metricValue": best.metric_value,
            "artifactUri": best.artifact_uri,
        }

        if payload.registerToMlflow:
            model_name = payload.modelName or task.mlflow.model_name or f"{payload.taskType}-best-model"
            response["registeredModel"] = register_model(
                tracking_uri=tracking_uri,
                run_id=best.run_id,
                model_name=model_name,
                artifact_path=payload.artifactPath or task.mlflow.artifact_path,
            )

        return response

    return _as_bad_request(_run)


@router.post("/mlflow/migrate-tensorboard")
def migrate_tensorboard(payload: MigrateTensorBoardRequest) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        return import_tensorboard_scalars(
            tensorboard_dir=payload.tensorboardDir,
            tracking_uri=payload.trackingUri,
            experiment_name=payload.experimentName,
            run_name=payload.runName,
        )

    return _as_bad_request(_run)


def _download_from_mlflow(payload: dict[str, Any]) -> dict[str, Any]:
    request = DownloadFromMlflowRequest(**payload)
    target_dir = Path(request.destinationDir).expanduser().resolve()
    local_path = download_artifact(
        tracking_uri=request.trackingUri,
        run_id=request.runId,
        artifact_path=request.artifactPath,
        destination_dir=str(target_dir),
    )
    return {"source": "mlflow", "localPath": local_path}


def _download_from_ftp(payload: dict[str, Any]) -> dict[str, Any]:
    request = DownloadFromFtpRequest(**payload)
    target_dir = Path(request.destinationDir).expanduser().resolve()
    local_path = download_file_via_ftp(
        host=request.host,
        port=request.port,
        username=request.username,
        password=request.password,
        remote_path=request.remotePath,
        destination_dir=str(target_dir),
    )
    return {"source": "ftp", "localPath": local_path}


@router.post("/models/download")
def download_model(payload: dict[str, Any]) -> dict[str, Any]:
    source = payload.get("source")
    handlers: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
        "mlflow": _download_from_mlflow,
        "ftp": _download_from_ftp,
    }
    handler = handlers.get(str(source))
    if handler is None:
        raise HTTPException(status_code=400, detail="source must be 'mlflow' or 'ftp'")
    return _as_bad_request(lambda: handler(payload))


@router.post("/serving/mlflow/start")
def start_mlflow_serving(payload: StartMlflowServingRequest) -> dict[str, Any]:
    return _as_bad_request(
        lambda: serving_manager.start_mlflow_server(
            model_uri=payload.modelUri,
            host=payload.host,
            port=payload.port,
        )
    )


@router.post("/serving/mlflow/stop")
def stop_mlflow_serving(payload: StopMlflowServingRequest) -> dict[str, Any]:
    try:
        return serving_manager.stop_mlflow_server(payload.serverId)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/serving/mlflow")
def list_mlflow_serving() -> dict[str, Any]:
    return {"items": serving_manager.list_mlflow_servers()}


@router.post("/serving/local/load")
def load_local_model(payload: LoadLocalModelRequest) -> dict[str, Any]:
    return _as_bad_request(
        lambda: serving_manager.load_local_model(
            alias=payload.alias,
            model_path=payload.modelPath,
            task_type=payload.taskType,
            num_classes=payload.numClasses,
        )
    )


@router.get("/serving/local")
def list_local_models() -> dict[str, Any]:
    return {"items": serving_manager.list_local_models()}


@router.post("/serving/local/predict")
def predict_local(payload: PredictRequest) -> dict[str, Any]:
    try:
        return serving_manager.predict(alias=payload.alias, inputs=payload.inputs)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        _raise_bad_request(error)


def _publish_ftp_from_mlflow(payload: PublishFtpModelRequest) -> dict[str, Any]:
    if not payload.runId:
        raise ValueError("runId is required when sourceType='mlflow'")
    return ftp_registry.publish_from_mlflow(
        model_name=payload.modelName,
        stage=payload.stage,
        version=payload.version,
        set_latest=payload.setLatest,
        notes=payload.notes,
        tracking_uri=payload.trackingUri or settings.default_mlflow_tracking_uri,
        run_id=payload.runId,
        artifact_path=payload.artifactPath,
        convert_to_torch_standard=payload.convertToTorchStandard,
        torch_task_type=payload.torchTaskType,
        torch_num_classes=payload.torchNumClasses,
    )


def _publish_ftp_from_local(payload: PublishFtpModelRequest) -> dict[str, Any]:
    if not payload.localPath:
        raise ValueError("localPath is required when sourceType='local'")
    return ftp_registry.publish_from_local(
        model_name=payload.modelName,
        stage=payload.stage,
        local_source_path=payload.localPath,
        version=payload.version,
        set_latest=payload.setLatest,
        notes=payload.notes,
        source_metadata={"type": "local", "localPath": payload.localPath},
        convert_to_torch_standard=payload.convertToTorchStandard,
        torch_task_type=payload.torchTaskType,
        torch_num_classes=payload.torchNumClasses,
    )


@router.post("/ftp-registry/publish")
def publish_to_ftp_registry(payload: PublishFtpModelRequest) -> dict[str, Any]:
    if payload.sourceType == "mlflow":
        return _as_bad_request(lambda: _publish_ftp_from_mlflow(payload))
    return _as_bad_request(lambda: _publish_ftp_from_local(payload))


@router.post("/ftp-registry/promote")
def promote_ftp_model(payload: PromoteFtpModelRequest) -> dict[str, Any]:
    return _as_bad_request(
        lambda: ftp_registry.promote(
            model_name=payload.modelName,
            from_stage=payload.fromStage,
            to_stage=payload.toStage,
            version=payload.version,
            target_version=payload.targetVersion,
            set_latest=payload.setLatest,
            notes=payload.notes,
        )
    )


@router.get("/ftp-registry/models")
def list_ftp_models(stage: str = "dev") -> dict[str, Any]:
    return {"items": ftp_registry.list_models(stage=_validate_stage(stage))}


@router.get("/ftp-registry/models/{stage}/{model_name}")
def get_ftp_model(stage: str, model_name: str) -> dict[str, Any]:
    validated_stage = _validate_stage(stage)
    try:
        return ftp_registry.get_model(stage=validated_stage, model_name=model_name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        _raise_bad_request(error)


@router.get("/ftp-registry/models/{stage}/{model_name}/resolve")
def resolve_ftp_model(stage: str, model_name: str, version: str = "latest") -> dict[str, Any]:
    validated_stage = _validate_stage(stage)
    try:
        return ftp_registry.resolve(stage=validated_stage, model_name=model_name, version=version)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        _raise_bad_request(error)


@router.get("/ftp-registry/layout")
def ftp_layout() -> dict[str, Any]:
    return {
        "rootPath": str(ftp_registry.root_dir),
        "layout": {
            "description": "FTP clients read LATEST to resolve latest version, then download bundle.tar.gz",
            "pattern": "/<stage>/<model_slug>/versions/<version>/bundle.tar.gz",
            "latestPointer": "/<stage>/<model_slug>/LATEST",
            "metadata": "/<stage>/<model_slug>/index.json",
        },
    }


@router.post("/ftp-server/start")
def start_ftp_server(payload: StartFtpServerRequest) -> dict[str, Any]:
    return _as_bad_request(
        lambda: ftp_server_manager.start_server(
            host=payload.host,
            port=payload.port,
            username=payload.username,
            password=payload.password,
            root_path=payload.rootPath or str(ftp_registry.root_dir),
        )
    )


@router.post("/ftp-server/stop")
def stop_ftp_server(payload: StopFtpServerRequest) -> dict[str, Any]:
    try:
        return ftp_server_manager.stop_server(payload.serverId)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/ftp-server")
def list_ftp_servers() -> dict[str, Any]:
    return {"items": ftp_server_manager.list_servers()}
