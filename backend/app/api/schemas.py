from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

TaskType = str
BaseTaskType = Literal["classification", "segmentation"]
RegistryStage = Literal["dev", "release"]


class StartRunRequest(BaseModel):
    taskType: TaskType
    values: dict[str, Any] = Field(default_factory=dict)


class StopRunRequest(BaseModel):
    runId: str


class SelectBestRequest(BaseModel):
    taskType: TaskType
    metric: str | None = None
    mode: Literal["max", "min"] | None = None
    experimentName: str | None = None
    modelName: str | None = None
    registerToMlflow: bool = True
    artifactPath: str = "model"


class DownloadFromMlflowRequest(BaseModel):
    source: Literal["mlflow"] = "mlflow"
    trackingUri: str
    runId: str
    artifactPath: str = "model"
    destinationDir: str = "./backend/artifacts/downloads"


class DownloadFromFtpRequest(BaseModel):
    source: Literal["ftp"] = "ftp"
    host: str
    port: int = 21
    username: str
    password: str
    remotePath: str
    destinationDir: str = "./backend/artifacts/downloads"


class MigrateTensorBoardRequest(BaseModel):
    tensorboardDir: str
    trackingUri: str
    experimentName: str
    runName: str = "tb-import"


class StartMlflowServingRequest(BaseModel):
    modelUri: str
    host: str = "0.0.0.0"
    port: int = 7001


class StopMlflowServingRequest(BaseModel):
    serverId: str


class LoadLocalModelRequest(BaseModel):
    alias: str
    modelPath: str
    taskType: BaseTaskType | None = None
    numClasses: int | None = None


class PredictRequest(BaseModel):
    alias: str
    inputs: Any


class PublishFtpModelRequest(BaseModel):
    modelName: str
    stage: RegistryStage = "dev"
    sourceType: Literal["mlflow", "local"] = "mlflow"
    version: str | None = None
    setLatest: bool = True
    notes: str | None = None
    trackingUri: str | None = None
    runId: str | None = None
    artifactPath: str = "model"
    localPath: str | None = None


class PromoteFtpModelRequest(BaseModel):
    modelName: str
    fromStage: RegistryStage = "dev"
    toStage: RegistryStage = "release"
    version: str = "latest"
    targetVersion: str | None = None
    setLatest: bool = True
    notes: str | None = None


class StartFtpServerRequest(BaseModel):
    host: str = "0.0.0.0"
    port: int = 2121
    username: str = "mlops"
    password: str = "mlops123!"
    rootPath: str | None = None


class StopFtpServerRequest(BaseModel):
    serverId: str
