import axios from 'axios'

import type {
  BaseTaskType,
  LocalModel,
  MlflowRunItem,
  MlflowServeServer,
  RegistryStage,
  RunItem,
  TaskSchema,
  TaskType,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8008/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
})

export const api = {
  getSchemas: async (): Promise<TaskSchema[]> => {
    const { data } = await client.get<{ items: TaskSchema[] }>('/config-schemas')
    return data.items
  },
  startRun: async (taskType: TaskType, values: Record<string, unknown>): Promise<RunItem> => {
    const { data } = await client.post<RunItem>('/runs/start', { taskType, values })
    return data
  },
  getRuns: async (): Promise<RunItem[]> => {
    const { data } = await client.get<{ items: RunItem[] }>('/runs')
    return data.items
  },
  stopRun: async (runId: string): Promise<RunItem> => {
    const { data } = await client.post<RunItem>(`/runs/${runId}/stop`)
    return data
  },
  getMlflowRuns: async (taskType: TaskType, limit = 20): Promise<MlflowRunItem[]> => {
    const { data } = await client.get<{ items: MlflowRunItem[] }>('/mlflow/runs', {
      params: { taskType, limit },
    })
    return data.items
  },
  selectBest: async (payload: {
    taskType: TaskType
    metric: string
    mode: 'max' | 'min'
    experimentName: string
    modelName?: string
    registerToMlflow: boolean
    artifactPath: string
  }): Promise<Record<string, unknown>> => {
    const { data } = await client.post('/mlflow/select-best', payload)
    return data
  },
  migrateTensorBoard: async (payload: {
    tensorboardDir: string
    trackingUri: string
    experimentName: string
    runName: string
  }): Promise<Record<string, unknown>> => {
    const { data } = await client.post('/mlflow/migrate-tensorboard', payload)
    return data
  },
  downloadModelFromMlflow: async (payload: {
    trackingUri: string
    runId: string
    artifactPath: string
    destinationDir: string
  }): Promise<{ source: string; localPath: string }> => {
    const { data } = await client.post('/models/download', { source: 'mlflow', ...payload })
    return data
  },
  downloadModelFromFtp: async (payload: {
    host: string
    port: number
    username: string
    password: string
    remotePath: string
    destinationDir: string
  }): Promise<{ source: string; localPath: string }> => {
    const { data } = await client.post('/models/download', { source: 'ftp', ...payload })
    return data
  },
  publishFtpModel: async (payload: {
    modelName: string
    stage: RegistryStage
    sourceType: 'local' | 'mlflow'
    version?: string
    setLatest?: boolean
    notes?: string
    localPath?: string
    trackingUri?: string
    runId?: string
    artifactPath?: string
    convertToTorchStandard?: boolean
    torchTaskType?: BaseTaskType
    torchNumClasses?: number
  }): Promise<Record<string, unknown>> => {
    const { data } = await client.post('/ftp-registry/publish', payload)
    return data
  },
  startMlflowServing: async (payload: {
    modelUri: string
    host: string
    port: number
  }): Promise<MlflowServeServer> => {
    const { data } = await client.post<MlflowServeServer>('/serving/mlflow/start', payload)
    return data
  },
  stopMlflowServing: async (serverId: string): Promise<MlflowServeServer> => {
    const { data } = await client.post<MlflowServeServer>('/serving/mlflow/stop', { serverId })
    return data
  },
  listMlflowServing: async (): Promise<MlflowServeServer[]> => {
    const { data } = await client.get<{ items: MlflowServeServer[] }>('/serving/mlflow')
    return data.items
  },
  loadLocalModel: async (payload: {
    alias: string
    modelPath: string
    taskType?: TaskType
    numClasses?: number
  }): Promise<LocalModel> => {
    const { data } = await client.post<LocalModel>('/serving/local/load', payload)
    return data
  },
  listLocalModels: async (): Promise<LocalModel[]> => {
    const { data } = await client.get<{ items: LocalModel[] }>('/serving/local')
    return data.items
  },
  predictLocal: async (alias: string, inputs: unknown): Promise<Record<string, unknown>> => {
    const { data } = await client.post('/serving/local/predict', { alias, inputs })
    return data
  },
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    return error.message
  }
  return error instanceof Error ? error.message : 'Unknown error'
}
