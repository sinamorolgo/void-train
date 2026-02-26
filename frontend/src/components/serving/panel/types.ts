import type {
  BaseTaskType,
  LocalModel,
  MlflowExperimentItem,
  RayServeServer,
  RegistryArtifact,
  RegistryCatalogModel,
  RegistryStage,
  TaskType,
} from '../../../types'

export interface ServingPanelProps {
  localModels: LocalModel[]
  rayServers: RayServeServer[]
  mlflowExperiments: MlflowExperimentItem[]
  registryModels: RegistryCatalogModel[]
  busy: boolean
  onDownloadFromMlflow: (payload: {
    trackingUri: string
    runId: string
    artifactPath: string
    destinationDir: string
  }) => void
  onDownloadFromFtp: (payload: {
    host: string
    port: number
    username: string
    password: string
    remotePath: string
    destinationDir: string
  }) => void
  onStartRayServing: (payload: {
    modelUri: string
    host: string
    port: number
    appName?: string
    routePrefix?: string
  }) => void
  onStopRayServing: (serverId: string) => void
  onLoadLocalModel: (payload: {
    alias: string
    modelPath: string
    taskType?: TaskType
    numClasses?: number
  }) => void
  onPublishFtpModel: (payload: {
    modelName: string
    stage: RegistryStage
    sourceType: 'local' | 'mlflow'
    localPath?: string
    version?: string
    setLatest?: boolean
    notes?: string
    convertToTorchStandard?: boolean
    torchTaskType?: BaseTaskType
    torchNumClasses?: number
    trackingUri?: string
    runId?: string
    artifactPath?: string
  }) => void
  onPublishBestFtpModel: (payload: {
    taskType: BaseTaskType
    stage: RegistryStage
    trackingUri?: string
    experimentName?: string
    metric?: string
    mode?: 'max' | 'min'
    modelName?: string
    artifactPath?: string
    version?: string
    setLatest?: boolean
    notes?: string
    convertToTorchStandard?: boolean
    torchTaskType?: BaseTaskType
    torchNumClasses?: number
  }) => void
  onUploadLocalFtpModel: (payload: {
    file: File
    modelName: string
    stage: RegistryStage
    version?: string
    setLatest?: boolean
    notes?: string
    convertToTorchStandard?: boolean
    torchTaskType?: BaseTaskType
    torchNumClasses?: number
  }) => void
  onDownloadRegistryModel: (payload: {
    modelName: string
    stage: RegistryStage
    version: string
    artifact: RegistryArtifact
    destinationDir: string
  }) => void
  onPredict: (alias: string, inputs: unknown) => void
}

export interface MlflowDownloadFormState {
  trackingUri: string
  runId: string
  artifactPath: string
}

export interface FtpDownloadFormState {
  host: string
  port: number
  username: string
  password: string
  remotePath: string
}

export interface RayServeFormState {
  modelUri: string
  host: string
  port: number
  appName: string
  routePrefix: string
}

export interface LocalLoaderFormState {
  alias: string
  modelPath: string
  taskType: TaskType
  numClasses: number
}

export interface RegisterLocalFormState {
  modelName: string
  stage: RegistryStage
  localPath: string
  version: string
  notes: string
  taskType: BaseTaskType
  numClasses: number
  convertToTorchStandard: boolean
}

export interface PublishBestFormState {
  trackingUri: string
  experimentName: string
  taskType: BaseTaskType
  metric: string
  mode: 'max' | 'min'
  modelName: string
  artifactPath: string
  stage: RegistryStage
  version: string
  notes: string
  convertToTorchStandard: boolean
  torchTaskType: BaseTaskType
  torchNumClasses: number
}

export interface UploadRegisterFormState {
  modelName: string
  stage: RegistryStage
  version: string
  notes: string
  taskType: BaseTaskType
  numClasses: number
  convertToTorchStandard: boolean
  file: File | null
}

export interface LocalPredictFormState {
  alias: string
  inputJson: string
}

export type DownloadFromMlflowPayload = Parameters<ServingPanelProps['onDownloadFromMlflow']>[0]
export type DownloadFromFtpPayload = Parameters<ServingPanelProps['onDownloadFromFtp']>[0]
export type StartRayServingPayload = Parameters<ServingPanelProps['onStartRayServing']>[0]
export type LoadLocalModelPayload = Parameters<ServingPanelProps['onLoadLocalModel']>[0]
export type PublishFtpModelPayload = Parameters<ServingPanelProps['onPublishFtpModel']>[0]
export type PublishBestFtpModelPayload = Parameters<ServingPanelProps['onPublishBestFtpModel']>[0]
export type UploadLocalFtpModelPayload = Parameters<ServingPanelProps['onUploadLocalFtpModel']>[0]
