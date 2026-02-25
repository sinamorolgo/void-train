export type TaskType = string

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
  baseTaskType: 'classification' | 'segmentation'
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
