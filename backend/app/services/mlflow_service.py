from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import mlflow
from mlflow import MlflowClient
from mlflow.entities import Run

Mode = Literal["max", "min"]


@dataclass
class BestRunResult:
    run_id: str
    metric_name: str
    metric_value: float
    artifact_uri: str


def _get_client(tracking_uri: str) -> MlflowClient:
    mlflow.set_tracking_uri(tracking_uri)
    return MlflowClient(tracking_uri=tracking_uri)


def ensure_experiment(tracking_uri: str, experiment_name: str) -> str:
    client = _get_client(tracking_uri)
    experiment = client.get_experiment_by_name(experiment_name)
    if experiment is not None:
        return experiment.experiment_id
    return client.create_experiment(experiment_name)


def list_runs(
    tracking_uri: str,
    experiment_name: str,
    *,
    limit: int = 30,
    task_type: str | None = None,
) -> list[dict[str, Any]]:
    client = _get_client(tracking_uri)
    experiment = client.get_experiment_by_name(experiment_name)
    if experiment is None:
        return []

    filter_string = None
    if task_type:
        filter_string = f"params.task_type = '{task_type}'"

    runs: list[Run] = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        filter_string=filter_string,
        run_view_type=1,
        max_results=limit,
        order_by=["attributes.start_time DESC"],
    )

    result: list[dict[str, Any]] = []
    for run in runs:
        result.append(
            {
                "runId": run.info.run_id,
                "runName": run.data.tags.get("mlflow.runName", run.info.run_id[:8]),
                "status": run.info.status,
                "startTime": run.info.start_time,
                "endTime": run.info.end_time,
                "metrics": run.data.metrics,
                "params": run.data.params,
                "artifactUri": run.info.artifact_uri,
            }
        )

    return result


def select_best_run(
    tracking_uri: str,
    experiment_name: str,
    metric_name: str,
    *,
    mode: Mode,
    task_type: str | None = None,
) -> BestRunResult:
    client = _get_client(tracking_uri)
    experiment = client.get_experiment_by_name(experiment_name)
    if experiment is None:
        raise ValueError(f"Experiment not found: {experiment_name}")

    filter_clauses: list[str] = []
    if task_type:
        filter_clauses.append(f"params.task_type = '{task_type}'")
    filter_string = " and ".join(filter_clauses) if filter_clauses else None

    order = "DESC" if mode == "max" else "ASC"
    candidates = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        filter_string=filter_string,
        run_view_type=1,
        max_results=200,
        order_by=[f"metrics.{metric_name} {order}", "attributes.start_time DESC"],
    )

    run = next((item for item in candidates if metric_name in item.data.metrics), None)
    if run is None:
        raise ValueError(
            f"No run found for metric={metric_name}, mode={mode}, experiment={experiment_name}"
        )
    metric_value = run.data.metrics.get(metric_name)
    if metric_value is None:
        raise ValueError(f"Metric {metric_name} missing on the best run candidate")

    return BestRunResult(
        run_id=run.info.run_id,
        metric_name=metric_name,
        metric_value=float(metric_value),
        artifact_uri=run.info.artifact_uri,
    )


def register_model(
    tracking_uri: str,
    *,
    run_id: str,
    model_name: str,
    artifact_path: str = "model",
) -> dict[str, Any]:
    mlflow.set_tracking_uri(tracking_uri)
    model_uri = f"runs:/{run_id}/{artifact_path}"
    version = mlflow.register_model(model_uri=model_uri, name=model_name)
    return {
        "modelName": model_name,
        "version": version.version,
        "status": str(version.status),
        "source": version.source,
    }


def download_artifact(
    tracking_uri: str,
    *,
    run_id: str,
    artifact_path: str,
    destination_dir: str,
) -> str:
    client = _get_client(tracking_uri)
    target = Path(destination_dir).expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    downloaded = client.download_artifacts(run_id, artifact_path, str(target))
    return str(Path(downloaded).resolve())


def build_mlflow_serve_command(model_uri: str, host: str, port: int) -> list[str]:
    return [
        "mlflow",
        "models",
        "serve",
        "--model-uri",
        model_uri,
        "--host",
        host,
        "--port",
        str(port),
        "--no-conda",
    ]
