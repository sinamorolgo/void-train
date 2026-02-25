import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import './App.css'
import { LaunchPanel } from './components/LaunchPanel'
import { MlflowPanel } from './components/MlflowPanel'
import { RunsPanel } from './components/RunsPanel'
import { ServingPanel } from './components/ServingPanel'
import { api, errorMessage } from './lib/api'
import { buildDefaults } from './hooks/useSchemaDefaults'
import type { TaskType } from './types'

interface Notice {
  level: 'info' | 'success' | 'error'
  message: string
  detail?: string
  timestamp: number
}

export default function App() {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<TaskType>('')
  const [formByTask, setFormByTask] = useState<Record<string, Record<string, unknown>>>({})
  const [notices, setNotices] = useState<Notice[]>([])

  const pushNotice = (level: Notice['level'], message: string, detail?: string) => {
    setNotices((prev) => [{ level, message, detail, timestamp: Date.now() }, ...prev].slice(0, 6))
  }

  const schemasQuery = useQuery({ queryKey: ['schemas'], queryFn: api.getSchemas })

  useEffect(() => {
    if (!schemasQuery.data || schemasQuery.data.length === 0) return

    setFormByTask((prev) => {
      const next = { ...prev }
      for (const schema of schemasQuery.data) {
        if (!next[schema.taskType] || Object.keys(next[schema.taskType]).length === 0) {
          next[schema.taskType] = buildDefaults(schema)
        }
      }
      return next
    })

    setSelectedTask((prev) => {
      const hasPrev = prev && schemasQuery.data.some((schema) => schema.taskType === prev)
      return hasPrev ? prev : schemasQuery.data[0].taskType
    })
  }, [schemasQuery.data])

  const selectedSchema = useMemo(
    () => (schemasQuery.data ?? []).find((schema) => schema.taskType === selectedTask),
    [schemasQuery.data, selectedTask],
  )
  const selectedValues = selectedTask ? formByTask[selectedTask] ?? {} : {}

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

  const mlflowServingQuery = useQuery({
    queryKey: ['mlflow-serving'],
    queryFn: api.listMlflowServing,
    refetchInterval: 3000,
  })

  const localModelsQuery = useQuery({
    queryKey: ['local-models'],
    queryFn: api.listLocalModels,
    refetchInterval: 3000,
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
      queryClient.invalidateQueries({ queryKey: ['mlflow-serving'] })
      queryClient.invalidateQueries({ queryKey: ['local-models'] })
    },
    onError: (error) => pushNotice('error', 'Serving action failed', errorMessage(error)),
  })

  const isBusy =
    launchMutation.isPending ||
    stopMutation.isPending ||
    mlflowActionMutation.isPending ||
    servingMutation.isPending

  const headline = useMemo(() => {
    const running = (runsQuery.data ?? []).filter((run) => run.status === 'running').length
    const finished = (runsQuery.data ?? []).filter((run) => run.status === 'completed').length
    return { running, finished }
  }, [runsQuery.data])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to Main Content
      </a>
      <header className="hero">
        <div>
          <p className="eyebrow">Void Train Manager</p>
          <h1>PyTorch Trainer Control Deck</h1>
          <p>
            TensorBoard 기반 워크플로를 유지하면서 MLflow 중심 운영으로 전환할 수 있는 통합 UI입니다.
          </p>
        </div>
        <div className="hero-stats">
          <article>
            <span>Running</span>
            <strong>{headline.running}</strong>
          </article>
          <article>
            <span>Completed</span>
            <strong>{headline.finished}</strong>
          </article>
          <article>
            <span>Task</span>
            <strong>{(selectedSchema?.title ?? selectedTask) || '-'}</strong>
          </article>
        </div>
      </header>

      {schemasQuery.isError ? <p className="error-banner">Schema load failed: {errorMessage(schemasQuery.error)}</p> : null}

      <main id="main-content">
        <LaunchPanel
          schemas={schemasQuery.data ?? []}
          selectedTask={selectedTask}
          values={selectedValues}
          onTaskChange={(task) => {
            setSelectedTask(task)
          }}
          onFieldChange={(name, value) => {
            setFormByTask((prev) => ({
              ...prev,
              [selectedTask]: {
                ...prev[selectedTask],
                [name]: value,
              },
            }))
          }}
          onLaunch={() => launchMutation.mutate()}
          isLaunching={launchMutation.isPending}
        />

        <RunsPanel
          runs={runsQuery.data ?? []}
          onStop={(runId) => {
            if (!window.confirm('Stop this training run?')) return
            stopMutation.mutate(runId)
          }}
          isStopping={stopMutation.isPending}
        />

        <MlflowPanel
          key={selectedTask}
          taskType={selectedTask}
          taskTitle={selectedSchema?.title ?? selectedTask}
          runs={mlflowRunsQuery.data ?? []}
          defaultMetric={selectedSchema?.mlflow.metric ?? 'val_accuracy'}
          defaultMode={selectedSchema?.mlflow.mode ?? 'max'}
          defaultModelName={selectedSchema?.mlflow.modelName ?? `${selectedTask}-best-model`}
          defaultArtifactPath={selectedSchema?.mlflow.artifactPath ?? 'model'}
          defaultTrackingUri={String(selectedValues.mlflow_tracking_uri ?? 'http://127.0.0.1:5001')}
          defaultExperiment={String(selectedValues.mlflow_experiment ?? 'void-train-manager')}
          busy={isBusy}
          onSelectBest={(payload) => mlflowActionMutation.mutate(() => api.selectBest(payload))}
          onMigrateTensorBoard={(payload) => mlflowActionMutation.mutate(() => api.migrateTensorBoard(payload))}
        />

        <ServingPanel
          localModels={localModelsQuery.data ?? []}
          mlflowServers={mlflowServingQuery.data ?? []}
          busy={isBusy}
          onDownloadFromMlflow={(payload) => servingMutation.mutate(() => api.downloadModelFromMlflow(payload))}
          onDownloadFromFtp={(payload) => servingMutation.mutate(() => api.downloadModelFromFtp(payload))}
          onStartMlflowServing={(payload) => servingMutation.mutate(() => api.startMlflowServing(payload))}
          onStopMlflowServing={(serverId) => servingMutation.mutate(() => api.stopMlflowServing(serverId))}
          onLoadLocalModel={(payload) => servingMutation.mutate(() => api.loadLocalModel(payload))}
          onPredict={(alias, inputs) => servingMutation.mutate(() => api.predictLocal(alias, inputs))}
        />
      </main>

      <aside className="notice-stack" aria-live="polite">
        {notices.map((notice) => (
          <article key={notice.timestamp} className={`notice ${notice.level}`}>
            <strong>{notice.message}</strong>
            {notice.detail ? <pre>{notice.detail}</pre> : null}
          </article>
        ))}
      </aside>
    </div>
  )
}
