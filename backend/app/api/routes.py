from __future__ import annotations

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
    SelectBestRequest,
    StartFtpServerRequest,
    StartMlflowServingRequest,
    StartRunRequest,
    StopFtpServerRequest,
    StopMlflowServingRequest,
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


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "defaultMlflowTrackingUri": settings.default_mlflow_tracking_uri,
        "defaultMlflowExperiment": settings.default_mlflow_experiment,
    }


@router.get("/config-schemas")
def config_schemas() -> dict[str, Any]:
    return {
        "items": [
            dataclass_schema("classification"),
            dataclass_schema("segmentation"),
        ]
    }


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
    taskType: TaskType | None = None,
    limit: int = 30,
) -> dict[str, Any]:
    def _run() -> dict[str, Any]:
        runs = list_runs(
            tracking_uri=trackingUri or settings.default_mlflow_tracking_uri,
            experiment_name=experimentName or settings.default_mlflow_experiment,
            task_type=taskType,
            limit=limit,
        )
        return {"items": runs}

    return _as_bad_request(_run)


@router.post("/mlflow/select-best")
def pick_best_run(payload: SelectBestRequest) -> dict[str, Any]:
    metric_name = payload.metric or get_metric_for_task(payload.taskType)

    tracking_uri = settings.default_mlflow_tracking_uri
    experiment_name = payload.experimentName or settings.default_mlflow_experiment

    def _run() -> dict[str, Any]:
        best = select_best_run(
            tracking_uri=tracking_uri,
            experiment_name=experiment_name,
            metric_name=metric_name,
            mode=payload.mode,
            task_type=payload.taskType,
        )

        response: dict[str, Any] = {
            "taskType": payload.taskType,
            "runId": best.run_id,
            "metric": best.metric_name,
            "metricValue": best.metric_value,
            "artifactUri": best.artifact_uri,
        }

        if payload.registerToMlflow:
            model_name = payload.modelName or f"{payload.taskType}-best-model"
            response["registeredModel"] = register_model(
                tracking_uri=tracking_uri,
                run_id=best.run_id,
                model_name=model_name,
                artifact_path=payload.artifactPath,
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
