import axios from 'axios'

import type {
  BaseTaskType,
  CatalogDocument,
  CatalogFormatResult,
  CatalogHistoryItem,
  CatalogStudioDocument,
  CatalogStudioRegistryModel,
  CatalogStudioTask,
  CatalogValidationResult,
  LocalModel,
  MlflowExperimentItem,
  MlflowRunItem,
  RayServeServer,
  RegistryArtifact,
  RegistryCatalogModel,
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
  getCatalog: async (): Promise<CatalogDocument> => {
    const { data } = await client.get<CatalogDocument>('/catalog')
    return data
  },
  getCatalogStudio: async (): Promise<CatalogStudioDocument> => {
    const { data } = await client.get<CatalogStudioDocument>('/catalog/studio')
    return data
  },
  validateCatalog: async (content: string): Promise<CatalogValidationResult> => {
    const { data } = await client.post<CatalogValidationResult>('/catalog/validate', { content })
    return data
  },
  formatCatalog: async (content: string): Promise<CatalogFormatResult> => {
    const { data } = await client.post<CatalogFormatResult>('/catalog/format', { content })
    return data
  },
  saveCatalog: async (payload: { content: string; createBackup: boolean }): Promise<CatalogDocument> => {
    const { data } = await client.post<CatalogDocument>('/catalog/save', payload)
    return data
  },
  saveCatalogStudio: async (payload: {
    tasks: CatalogStudioTask[]
    registryModels: CatalogStudioRegistryModel[]
    createBackup: boolean
  }): Promise<CatalogStudioDocument> => {
    const { data } = await client.post<CatalogStudioDocument>('/catalog/studio/save', payload)
    return data
  },
  getCatalogHistory: async (limit = 30): Promise<CatalogHistoryItem[]> => {
    const { data } = await client.get<{ storage: string; items: CatalogHistoryItem[] }>('/catalog/history', {
      params: { limit },
    })
    return data.items
  },
  restoreCatalogRevision: async (revisionId: number): Promise<CatalogDocument> => {
    const { data } = await client.post<CatalogDocument>('/catalog/restore', { revisionId })
    return data
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
  getMlflowExperiments: async (trackingUri?: string): Promise<MlflowExperimentItem[]> => {
    const { data } = await client.get<{ items: MlflowExperimentItem[] }>('/mlflow/experiments', {
      params: trackingUri ? { trackingUri } : undefined,
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
  publishBestFtpModel: async (payload: {
    taskType: TaskType
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
  }): Promise<Record<string, unknown>> => {
    const { data } = await client.post('/ftp-registry/publish-best', payload)
    return data
  },
  uploadLocalFtpModel: async (payload: {
    file: File
    modelName: string
    stage: RegistryStage
    version?: string
    setLatest?: boolean
    notes?: string
    convertToTorchStandard?: boolean
    torchTaskType?: BaseTaskType
    torchNumClasses?: number
  }): Promise<Record<string, unknown>> => {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('modelName', payload.modelName)
    form.append('stage', payload.stage)
    form.append('setLatest', String(payload.setLatest ?? true))
    form.append('convertToTorchStandard', String(payload.convertToTorchStandard ?? false))
    if (payload.version) form.append('version', payload.version)
    if (payload.notes) form.append('notes', payload.notes)
    if (payload.torchTaskType) form.append('torchTaskType', payload.torchTaskType)
    if (payload.torchNumClasses !== undefined) form.append('torchNumClasses', String(payload.torchNumClasses))

    const { data } = await client.post('/ftp-registry/upload-local', form)
    return data
  },
  getRegistryCatalogModels: async (): Promise<RegistryCatalogModel[]> => {
    const { data } = await client.get<{ items: RegistryCatalogModel[] }>('/ftp-registry/catalog-models', {
      params: { includeVersions: true },
    })
    return data.items
  },
  downloadRegistryModel: async (payload: {
    modelName: string
    stage: RegistryStage
    version: string
    artifact: RegistryArtifact
    destinationDir: string
  }): Promise<{
    modelName: string
    stage: RegistryStage
    requestedVersion: string
    resolvedVersion: string
    artifact: RegistryArtifact
    remotePath: string
    localPath: string
  }> => {
    const { data } = await client.post('/ftp-registry/download', payload)
    return data
  },
  startRayServing: async (payload: {
    modelUri: string
    host: string
    port: number
    appName?: string
    routePrefix?: string
  }): Promise<RayServeServer> => {
    const { data } = await client.post<RayServeServer>('/serving/ray/start', payload)
    return data
  },
  stopRayServing: async (serverId: string): Promise<RayServeServer> => {
    const { data } = await client.post<RayServeServer>('/serving/ray/stop', { serverId })
    return data
  },
  listRayServing: async (): Promise<RayServeServer[]> => {
    const { data } = await client.get<{ items: RayServeServer[] }>('/serving/ray')
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
