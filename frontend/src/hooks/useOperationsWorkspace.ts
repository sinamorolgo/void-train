import { useMemo, useState } from 'react'
import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query'

import type { NoticeItem } from '../components/app-shell/NoticeStack'
import type { OperationsWorkspaceProps } from '../components/workspace/OperationsWorkspace'
import { buildDefaults } from './useSchemaDefaults'
import { api, errorMessage } from '../lib/api'
import type { TaskType } from '../types'

interface UseOperationsWorkspaceOptions {
  queryClient: QueryClient
  pushNotice: (level: NoticeItem['level'], message: string, detail?: string) => void
}

export interface OperationsWorkspaceState {
  selectedTaskLabel: string
  headline: {
    running: number
    finished: number
  }
  schemasErrorMessage: string | null
  isWorking: boolean
  operationsPanelProps: OperationsWorkspaceProps
}

export function useOperationsWorkspace({ queryClient, pushNotice }: UseOperationsWorkspaceOptions): OperationsWorkspaceState {
  const [selectedTaskState, setSelectedTaskState] = useState<TaskType>('')
  const [formByTask, setFormByTask] = useState<Record<string, Record<string, unknown>>>({})

  const schemasQuery = useQuery({ queryKey: ['schemas'], queryFn: api.getSchemas })

  const schemas = useMemo(() => schemasQuery.data ?? [], [schemasQuery.data])

  const defaultFormByTask = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {}
    for (const schema of schemas) {
      map[schema.taskType] = buildDefaults(schema)
    }
    return map
  }, [schemas])

  const selectedTask = useMemo(() => {
    if (selectedTaskState && schemas.some((schema) => schema.taskType === selectedTaskState)) {
      return selectedTaskState
    }
    return schemas[0]?.taskType ?? ''
  }, [schemas, selectedTaskState])

  const selectedSchema = useMemo(
    () => schemas.find((schema) => schema.taskType === selectedTask),
    [schemas, selectedTask],
  )

  const selectedValues = useMemo(() => {
    if (!selectedTask) return {}
    return {
      ...(defaultFormByTask[selectedTask] ?? {}),
      ...(formByTask[selectedTask] ?? {}),
    }
  }, [defaultFormByTask, formByTask, selectedTask])

  const runsQuery = useQuery({
    queryKey: ['runs'],
    queryFn: api.getRuns,
    refetchInterval: 1500,
  })

  const mlflowRunsQuery = useQuery({
    queryKey: ['mlflow-runs', selectedTask],
    queryFn: () => api.getMlflowRuns(selectedTask),
    enabled: Boolean(selectedTask),
    refetchInterval: 3000,
  })

  const mlflowExperimentsQuery = useQuery({
    queryKey: ['mlflow-experiments'],
    queryFn: () => api.getMlflowExperiments(String(selectedValues.mlflow_tracking_uri ?? 'http://127.0.0.1:5001')),
    enabled: Boolean(selectedTask),
    refetchInterval: 30000,
  })

  const rayServingQuery = useQuery({
    queryKey: ['ray-serving'],
    queryFn: api.listRayServing,
    refetchInterval: 3000,
  })

  const localModelsQuery = useQuery({
    queryKey: ['local-models'],
    queryFn: api.listLocalModels,
    refetchInterval: 3000,
  })

  const registryModelsQuery = useQuery({
    queryKey: ['ftp-registry-catalog-models'],
    queryFn: api.getRegistryCatalogModels,
    refetchInterval: 5000,
  })

  const launchMutation = useMutation({
    mutationFn: () => api.startRun(selectedTask, selectedValues),
    onSuccess: (run) => {
      pushNotice('success', `Training started: ${run.runId.slice(0, 8)}`)
      queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
    onError: (error) => pushNotice('error', 'Failed to start run', errorMessage(error)),
  })

  const stopMutation = useMutation({
    mutationFn: (runId: string) => api.stopRun(runId),
    onSuccess: (run) => {
      pushNotice('info', `Run stopped: ${run.runId.slice(0, 8)}`)
      queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
    onError: (error) => pushNotice('error', 'Failed to stop run', errorMessage(error)),
  })

  const mlflowActionMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: (result) => {
      pushNotice('success', 'MLflow action completed', JSON.stringify(result, null, 2))
      queryClient.invalidateQueries({ queryKey: ['mlflow-runs'] })
    },
    onError: (error) => pushNotice('error', 'MLflow action failed', errorMessage(error)),
  })

  const servingMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: (result) => {
      pushNotice('success', 'Serving action completed', JSON.stringify(result, null, 2))
      queryClient.invalidateQueries({ queryKey: ['ray-serving'] })
      queryClient.invalidateQueries({ queryKey: ['local-models'] })
      queryClient.invalidateQueries({ queryKey: ['ftp-registry-catalog-models'] })
      queryClient.invalidateQueries({ queryKey: ['mlflow-experiments'] })
    },
    onError: (error) => pushNotice('error', 'Serving action failed', errorMessage(error)),
  })

  const isWorking =
    launchMutation.isPending || stopMutation.isPending || mlflowActionMutation.isPending || servingMutation.isPending

  const headline = useMemo(() => {
    const running = (runsQuery.data ?? []).filter((run) => run.status === 'running').length
    const finished = (runsQuery.data ?? []).filter((run) => run.status === 'completed').length
    return { running, finished }
  }, [runsQuery.data])

  const operationsPanelProps: OperationsWorkspaceProps = {
    launchPanelProps: {
      schemas,
      selectedTask,
      values: selectedValues,
      onTaskChange: setSelectedTaskState,
      onFieldChange: (name, value) => {
        setFormByTask((previous) => ({
          ...previous,
          [selectedTask]: {
            ...previous[selectedTask],
            [name]: value,
          },
        }))
      },
      onLaunch: () => launchMutation.mutate(),
      isLaunching: launchMutation.isPending,
    },
    runsPanelProps: {
      runs: runsQuery.data ?? [],
      onStop: (runId) => {
        const shouldStop = window.confirm('Stop this training run?')
        if (!shouldStop) return
        stopMutation.mutate(runId)
      },
      isStopping: stopMutation.isPending,
    },
    mlflowPanelProps: {
      taskType: selectedTask,
      taskTitle: selectedSchema?.title ?? selectedTask,
      runs: mlflowRunsQuery.data ?? [],
      defaultMetric: selectedSchema?.mlflow.metric ?? 'val_accuracy',
      defaultMode: selectedSchema?.mlflow.mode ?? 'max',
      defaultModelName: selectedSchema?.mlflow.modelName ?? `${selectedTask}-best-model`,
      defaultArtifactPath: selectedSchema?.mlflow.artifactPath ?? 'model',
      defaultTrackingUri: String(selectedValues.mlflow_tracking_uri ?? 'http://127.0.0.1:5001'),
      defaultExperiment: String(selectedValues.mlflow_experiment ?? 'void-train-manager'),
      busy: isWorking,
      onSelectBest: (payload) => mlflowActionMutation.mutate(() => api.selectBest(payload)),
      onMigrateTensorBoard: (payload) => mlflowActionMutation.mutate(() => api.migrateTensorBoard(payload)),
    },
    servingPanelProps: {
      localModels: localModelsQuery.data ?? [],
      rayServers: rayServingQuery.data ?? [],
      mlflowExperiments: mlflowExperimentsQuery.data ?? [],
      registryModels: registryModelsQuery.data ?? [],
      busy: isWorking,
      onDownloadFromMlflow: (payload) => servingMutation.mutate(() => api.downloadModelFromMlflow(payload)),
      onDownloadFromFtp: (payload) => servingMutation.mutate(() => api.downloadModelFromFtp(payload)),
      onDownloadRegistryModel: (payload) => servingMutation.mutate(() => api.downloadRegistryModel(payload)),
      onStartRayServing: (payload) => servingMutation.mutate(() => api.startRayServing(payload)),
      onStopRayServing: (serverId) => servingMutation.mutate(() => api.stopRayServing(serverId)),
      onLoadLocalModel: (payload) => servingMutation.mutate(() => api.loadLocalModel(payload)),
      onPublishFtpModel: (payload) => servingMutation.mutate(() => api.publishFtpModel(payload)),
      onPublishBestFtpModel: (payload) => servingMutation.mutate(() => api.publishBestFtpModel(payload)),
      onUploadLocalFtpModel: (payload) => servingMutation.mutate(() => api.uploadLocalFtpModel(payload)),
      onPredict: (alias, inputs) => servingMutation.mutate(() => api.predictLocal(alias, inputs)),
    },
  }

  const schemasErrorMessage = schemasQuery.isError ? errorMessage(schemasQuery.error) : null

  return {
    selectedTaskLabel: (selectedSchema?.title ?? selectedTask) || '-',
    headline,
    schemasErrorMessage,
    isWorking,
    operationsPanelProps,
  }
}
