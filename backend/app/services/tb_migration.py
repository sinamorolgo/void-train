from __future__ import annotations

from pathlib import Path
from typing import Any

import mlflow
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator


def import_tensorboard_scalars(
    *,
    tensorboard_dir: str,
    tracking_uri: str,
    experiment_name: str,
    run_name: str,
) -> dict[str, Any]:
    root = Path(tensorboard_dir).expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(f"TensorBoard directory not found: {root}")

    event_files = list(root.rglob("events.out.tfevents.*"))
    if not event_files:
        raise FileNotFoundError(f"No TensorBoard event files found in: {root}")

    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(experiment_name)

    logged_metrics = 0
    tags_seen: set[str] = set()

    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_param("migration_source", str(root))
        mlflow.log_param("migrated_event_files", len(event_files))

        for event_file in event_files:
            accumulator = EventAccumulator(str(event_file), size_guidance={"scalars": 0})
            accumulator.Reload()

            for scalar_tag in accumulator.Tags().get("scalars", []):
                tags_seen.add(scalar_tag)
                for scalar_event in accumulator.Scalars(scalar_tag):
                    mlflow.log_metric(
                        scalar_tag,
                        float(scalar_event.value),
                        step=int(scalar_event.step),
                    )
                    logged_metrics += 1

    return {
        "runId": run.info.run_id,
        "eventFileCount": len(event_files),
        "metricCount": logged_metrics,
        "tags": sorted(tags_seen),
    }
