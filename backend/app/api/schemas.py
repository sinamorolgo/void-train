from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

TaskType = str
BaseTaskType = Literal["classification", "segmentation"]
RegistryStage = Literal["dev", "release"]
RegistryArtifact = Literal["bundle", "manifest", "standard_pytorch"]
RunnerStartMethod = Literal["python_script", "python_module"]


class StartRunRequest(BaseModel):
    taskType: TaskType
    values: dict[str, Any] = Field(default_factory=dict)


class StopRunRequest(BaseModel):
    runId: str


class ValidateCatalogRequest(BaseModel):
    content: str = Field(min_length=1)


class SaveCatalogRequest(BaseModel):
    content: str = Field(min_length=1)
    createBackup: bool = True


class RestoreCatalogRevisionRequest(BaseModel):
    revisionId: int = Field(ge=1)


class CatalogStudioExtraFieldItem(BaseModel):
    name: str
    valueType: Literal["str", "int", "float", "bool"] = "str"
    type: Literal["text", "number", "boolean", "select"] | None = None
    required: bool = False
    default: Any = None
    label: str | None = None
    description: str = ""
    group: str = "custom"
    choices: list[str] = Field(default_factory=list)
    min: float | int | None = None
    max: float | int | None = None
    step: float | int | None = None
    cliArg: str | None = None
    passWhenEmpty: bool = False


class CatalogStudioTaskItem(BaseModel):
    taskType: str
    enabled: bool = True
    title: str
    description: str = ""
    baseTaskType: BaseTaskType
    runnerStartMethod: RunnerStartMethod = "python_script"
    runnerTarget: str
    runnerTargetEnvVar: str | None = None
    runnerCwd: str | None = None
    mlflowMetric: str = "val_accuracy"
    mlflowMode: Literal["max", "min"] = "max"
    mlflowModelName: str
    mlflowArtifactPath: str = "model"
    fieldOrder: list[str] = Field(default_factory=list)
    hiddenFields: list[str] = Field(default_factory=list)
    fieldOverrides: dict[str, dict[str, Any]] = Field(default_factory=dict)
    extraFields: list[CatalogStudioExtraFieldItem] = Field(default_factory=list)


class CatalogStudioRegistryModelItem(BaseModel):
    id: str
    title: str
    description: str = ""
    taskType: BaseTaskType
    modelName: str
    defaultStage: RegistryStage = "release"
    defaultVersion: str = "latest"
    defaultDestinationDir: str = "./backend/artifacts/downloads"


class SaveCatalogStudioRequest(BaseModel):
    tasks: list[CatalogStudioTaskItem] = Field(default_factory=list)
    registryModels: list[CatalogStudioRegistryModelItem] = Field(default_factory=list)
    createBackup: bool = True


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


class DownloadRegisteredFtpModelRequest(BaseModel):
    modelName: str
    stage: RegistryStage = "release"
    version: str = "latest"
    artifact: RegistryArtifact = "bundle"
    destinationDir: str = "./backend/artifacts/downloads"
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None


class MigrateTensorBoardRequest(BaseModel):
    tensorboardDir: str
    trackingUri: str
    experimentName: str
    runName: str = "tb-import"


class StartRayServingRequest(BaseModel):
    modelUri: str
    host: str = "0.0.0.0"
    port: int = 7001
    appName: str = "void-train-manager"
    routePrefix: str = "/"


class StopRayServingRequest(BaseModel):
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
    convertToTorchStandard: bool = False
    torchTaskType: BaseTaskType | None = None
    torchNumClasses: int | None = None


class PublishBestFtpModelRequest(BaseModel):
    taskType: TaskType
    stage: RegistryStage = "dev"
    trackingUri: str | None = None
    experimentName: str | None = None
    metric: str | None = None
    mode: Literal["max", "min"] | None = None
    modelName: str | None = None
    artifactPath: str | None = None
    version: str | None = None
    setLatest: bool = True
    notes: str | None = None
    convertToTorchStandard: bool = False
    torchTaskType: BaseTaskType | None = None
    torchNumClasses: int | None = None


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
