export type TaskType = string
export type BaseTaskType = 'classification' | 'segmentation'
export type RegistryStage = 'dev' | 'release'
export type RegistryArtifact = 'bundle' | 'manifest' | 'standard_pytorch'

export type FieldType = 'text' | 'number' | 'boolean' | 'select'

export interface ConfigField {
  name: string
  type: FieldType
  valueType: string
  required: boolean
  default: string | number | boolean | null
  label: string
  description: string
  group: string
  choices?: string[]
  min?: number
  max?: number
  step?: number
}

export interface TaskSchema {
  taskType: TaskType
  baseTaskType: BaseTaskType
  title: string
  description?: string
  runner: {
    startMethod: 'python_script' | 'python_module'
    target: string
    targetEnvVar?: string | null
  }
  mlflow: {
    metric: string
    mode: 'max' | 'min'
    modelName: string
    artifactPath: string
  }
  fields: ConfigField[]
}

export interface RunProgress {
  epoch?: number
  total_epochs?: number
  train_loss?: number
  train_accuracy?: number
  val_loss?: number
  val_accuracy?: number
  val_iou?: number
  best_val_accuracy?: number
  best_val_iou?: number
  device?: string
}

export interface RunItem {
  runId: string
  taskType: TaskType
  status: 'running' | 'completed' | 'failed' | 'stopped'
  command: string[]
  config: Record<string, unknown>
  startedAt: string
  finishedAt: string | null
  pid: number | null
  exitCode: number | null
  progress: RunProgress
  mlflowRunId: string | null
  logs: string[]
}

export interface MlflowRunItem {
  runId: string
  runName: string
  status: string
  startTime: number
  endTime: number | null
  metrics: Record<string, number>
  params: Record<string, string>
  artifactUri: string
}

export interface MlflowServeServer {
  serverId: string
  modelUri: string
  host: string
  port: number
  startedAt: string
  finishedAt: string | null
  status: string
  pid: number | null
}

export interface LocalModel {
  alias: string
  taskType: TaskType
  path: string
  loadedAt: string
  numClasses: number
}

export interface CatalogTaskSummary {
  taskType: string
  title: string
  baseTaskType: BaseTaskType
  runnerTarget: string
  runnerStartMethod: 'python_script' | 'python_module'
  fieldOverrideCount: number
  fieldOrderCount: number
}

export interface RegistryVersionSummary {
  version: string
  createdAt: string | null
  notes: string | null
  sourceType: string | null
  bundle: string | null
  manifest: string | null
  hasTorchStandard: boolean
}

export interface RegistryStageSnapshot {
  exists: boolean
  latest: string | null
  versionCount: number
  updatedAt: string | null
  versions: RegistryVersionSummary[]
}

export interface RegistryCatalogModel {
  id: string
  title: string
  description: string
  taskType: BaseTaskType
  modelName: string
  defaultStage: RegistryStage
  defaultVersion: string
  defaultDestinationDir: string
  stages: Record<RegistryStage, RegistryStageSnapshot>
}

export interface CatalogDocument {
  path: string
  exists: boolean
  modifiedAt: string | null
  content: string
  taskCount: number
  tasks: CatalogTaskSummary[]
  saved?: boolean
  backupPath?: string | null
}

export interface CatalogValidationResult {
  valid: boolean
  taskCount: number
  tasks: CatalogTaskSummary[]
}

export interface CatalogFormatResult extends CatalogValidationResult {
  content: string
}

export interface CatalogStudioTask {
  taskType: string
  enabled: boolean
  title: string
  description: string
  baseTaskType: BaseTaskType
  runnerStartMethod: 'python_script' | 'python_module'
  runnerTarget: string
  runnerTargetEnvVar: string | null
  runnerCwd: string | null
  mlflowMetric: string
  mlflowMode: 'max' | 'min'
  mlflowModelName: string
  mlflowArtifactPath: string
  fieldOrder: string[]
  hiddenFields: string[]
  fieldOverrides: Record<string, Record<string, unknown>>
}

export interface CatalogStudioRegistryModel {
  id: string
  title: string
  description: string
  taskType: BaseTaskType
  modelName: string
  defaultStage: RegistryStage
  defaultVersion: string
  defaultDestinationDir: string
}

export interface CatalogStudioDocument {
  path: string
  exists: boolean
  modifiedAt: string | null
  taskCount: number
  registryModelCount: number
  tasks: CatalogStudioTask[]
  registryModels: CatalogStudioRegistryModel[]
  saved?: boolean
  backupPath?: string | null
}
