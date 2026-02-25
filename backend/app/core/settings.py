from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    app_host: str
    app_port: int
    cors_origins: list[str]
    default_mlflow_tracking_uri: str
    default_mlflow_experiment: str
    backend_root: Path
    project_root: Path
    artifacts_root: Path
    ftp_registry_root: Path
    ftp_default_host: str
    ftp_default_port: int
    ftp_default_username: str
    ftp_default_password: str
    training_catalog_path: Path
    runs_log_tail: int

    @property
    def classification_script(self) -> Path:
        configured = os.getenv("CLASSIFICATION_SCRIPT_PATH")
        if configured:
            return Path(configured).expanduser().resolve()
        return self.backend_root / "trainers" / "train_classification.py"

    @property
    def segmentation_script(self) -> Path:
        configured = os.getenv("SEGMENTATION_SCRIPT_PATH")
        if configured:
            return Path(configured).expanduser().resolve()
        return self.backend_root / "trainers" / "train_segmentation.py"


def _parse_csv(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[2]
    project_root = backend_root.parent
    load_dotenv(project_root / ".env", override=False)
    artifacts_root = Path(os.getenv("ARTIFACTS_ROOT", str(backend_root / "artifacts"))).expanduser().resolve()
    artifacts_root.mkdir(parents=True, exist_ok=True)
    ftp_registry_root = Path(
        os.getenv("FTP_REGISTRY_ROOT", str(artifacts_root / "ftp-model-registry"))
    ).expanduser().resolve()
    ftp_registry_root.mkdir(parents=True, exist_ok=True)

    return Settings(
        app_host=os.getenv("APP_HOST", "0.0.0.0"),
        app_port=int(os.getenv("APP_PORT", "8008")),
        cors_origins=_parse_csv(os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173")),
        default_mlflow_tracking_uri=os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5001"),
        default_mlflow_experiment=os.getenv("MLFLOW_EXPERIMENT", "void-train-manager"),
        backend_root=backend_root,
        project_root=project_root,
        artifacts_root=artifacts_root,
        ftp_registry_root=ftp_registry_root,
        ftp_default_host=os.getenv("FTP_DEFAULT_HOST", "0.0.0.0"),
        ftp_default_port=int(os.getenv("FTP_DEFAULT_PORT", "2121")),
        ftp_default_username=os.getenv("FTP_DEFAULT_USERNAME", "mlops"),
        ftp_default_password=os.getenv("FTP_DEFAULT_PASSWORD", "mlops123!"),
        training_catalog_path=Path(
            os.getenv("TRAINING_CATALOG_PATH", str(backend_root / "config" / "training_catalog.yaml"))
        ).expanduser().resolve(),
        runs_log_tail=int(os.getenv("RUNS_LOG_TAIL", "200")),
    )
