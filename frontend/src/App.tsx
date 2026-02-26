import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import './App.css'
import { CatalogManagerPanel } from './components/CatalogManagerPanel'
import { CatalogStudioPanel } from './components/CatalogStudioPanel'
import { LaunchPanel } from './components/LaunchPanel'
import { MlflowPanel } from './components/MlflowPanel'
import { RunsPanel } from './components/RunsPanel'
import { ServingPanel } from './components/ServingPanel'
import { api, errorMessage } from './lib/api'
import { buildDefaults } from './hooks/useSchemaDefaults'
import type {
  CatalogStudioRegistryModel,
  CatalogStudioTask,
  CatalogValidationResult,
  TaskType,
} from './types'

interface Notice {
  level: 'info' | 'success' | 'error'
  message: string
  detail?: string
  timestamp: number
}

type AppView = 'operations' | 'catalog' | 'studio'
const TAB_QUERY_KEY = 'tab'
type CatalogValidationState = 'idle' | 'valid' | 'invalid'
interface CatalogStudioDraft {
  tasks: CatalogStudioTask[]
  registryModels: CatalogStudioRegistryModel[]
}

function parseViewFromUrl(): AppView {
  const tab = new URLSearchParams(window.location.search).get(TAB_QUERY_KEY)
  if (tab === 'studio') return 'studio'
  return tab === 'catalog' ? 'catalog' : 'operations'
}

function syncViewToUrl(nextView: AppView): void {
  const url = new URL(window.location.href)
  if (nextView === 'operations') {
    url.searchParams.delete(TAB_QUERY_KEY)
  } else {
    url.searchParams.set(TAB_QUERY_KEY, nextView)
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export default function App() {
  const queryClient = useQueryClient()
  const [selectedTaskState, setSelectedTaskState] = useState<TaskType>('')
  const [activeView, setActiveView] = useState<AppView>(() => parseViewFromUrl())
  const [formByTask, setFormByTask] = useState<Record<string, Record<string, unknown>>>({})
  const [catalogDraftOverride, setCatalogDraftOverride] = useState<string | null>(null)
  const [catalogBaselineOverride, setCatalogBaselineOverride] = useState<string | null>(null)
  const [createBackup, setCreateBackup] = useState(true)
  const [catalogValidation, setCatalogValidation] = useState<CatalogValidationResult | null>(null)
  const [catalogValidationError, setCatalogValidationError] = useState<string | null>(null)
  const [catalogValidationState, setCatalogValidationState] = useState<CatalogValidationState>('idle')
  const [catalogValidatedAt, setCatalogValidatedAt] = useState<string | null>(null)
  const [studioDraftOverride, setStudioDraftOverride] = useState<CatalogStudioDraft | null>(null)
  const [studioBaselineOverride, setStudioBaselineOverride] = useState<CatalogStudioDraft | null>(null)
  const [studioCreateBackup, setStudioCreateBackup] = useState(true)
  const [studioSaveError, setStudioSaveError] = useState<string | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])

  const pushNotice = (level: Notice['level'], message: string, detail?: string) => {
    setNotices((prev) => [{ level, message, detail, timestamp: Date.now() }, ...prev].slice(0, 6))
  }

  const schemasQuery = useQuery({ queryKey: ['schemas'], queryFn: api.getSchemas })
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: api.getCatalog,
    refetchOnWindowFocus: false,
  })
  const catalogStudioQuery = useQuery({
    queryKey: ['catalog-studio'],
    queryFn: api.getCatalogStudio,
    refetchOnWindowFocus: false,
  })

  const schemas = useMemo(() => schemasQuery.data ?? [], [schemasQuery.data])
  const catalogDraft = catalogDraftOverride ?? catalogQuery.data?.content ?? ''
  const catalogBaseline = catalogBaselineOverride ?? catalogQuery.data?.content ?? ''
  const catalogTasks = catalogValidation?.tasks ?? catalogQuery.data?.tasks ?? []
  const catalogTaskCount = catalogValidation?.taskCount ?? catalogQuery.data?.taskCount ?? null
  const catalogDirty = catalogDraft !== catalogBaseline
  const studioDraft = useMemo<CatalogStudioDraft>(
    () =>
      studioDraftOverride ?? {
        tasks: catalogStudioQuery.data?.tasks ?? [],
        registryModels: catalogStudioQuery.data?.registryModels ?? [],
      },
    [studioDraftOverride, catalogStudioQuery.data?.tasks, catalogStudioQuery.data?.registryModels],
  )
  const studioBaseline = useMemo<CatalogStudioDraft>(
    () =>
      studioBaselineOverride ?? {
        tasks: catalogStudioQuery.data?.tasks ?? [],
        registryModels: catalogStudioQuery.data?.registryModels ?? [],
      },
    [studioBaselineOverride, catalogStudioQuery.data?.tasks, catalogStudioQuery.data?.registryModels],
  )
  const studioDirty = JSON.stringify(studioDraft) !== JSON.stringify(studioBaseline)

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

  const validateCatalogMutation = useMutation({
    mutationFn: () => api.validateCatalog(catalogDraft),
    onSuccess: (result) => {
      setCatalogValidation(result)
      setCatalogValidationError(null)
      setCatalogValidationState('valid')
      setCatalogValidatedAt(new Date().toISOString())
      pushNotice('success', `Catalog validation passed (${result.taskCount} tasks)`)
    },
    onError: (error) => {
      const message = errorMessage(error)
      setCatalogValidationError(message)
      setCatalogValidationState('invalid')
      pushNotice('error', 'Catalog validation failed', message)
    },
  })

  const formatCatalogMutation = useMutation({
    mutationFn: () => api.formatCatalog(catalogDraft),
    onSuccess: (result) => {
      setCatalogDraftOverride(result.content)
      setCatalogValidation({
        valid: true,
        taskCount: result.taskCount,
        tasks: result.tasks,
      })
      setCatalogValidationError(null)
      setCatalogValidationState('valid')
      setCatalogValidatedAt(new Date().toISOString())
      pushNotice('success', 'Catalog formatted', `Normalized YAML (${result.taskCount} tasks)`)
    },
    onError: (error) => {
      const message = errorMessage(error)
      setCatalogValidationError(message)
      setCatalogValidationState('invalid')
      pushNotice('error', 'Catalog format failed', message)
    },
  })

  const saveCatalogMutation = useMutation({
    mutationFn: () => api.saveCatalog({ content: catalogDraft, createBackup }),
    onSuccess: (saved) => {
      setCatalogDraftOverride(saved.content)
      setCatalogBaselineOverride(saved.content)
      setCatalogValidation({
        valid: true,
        taskCount: saved.taskCount,
        tasks: saved.tasks,
      })
      setCatalogValidationError(null)
      setCatalogValidationState('valid')
      setCatalogValidatedAt(new Date().toISOString())
      pushNotice(
        'success',
        'Catalog saved and applied',
        saved.backupPath ? `Backup created: ${saved.backupPath}` : 'Saved without backup',
      )
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
    },
    onError: (error) => {
      setCatalogValidationState('invalid')
      pushNotice('error', 'Catalog save failed', errorMessage(error))
    },
  })

  const saveCatalogStudioMutation = useMutation({
    mutationFn: () =>
      api.saveCatalogStudio({
        tasks: studioDraft.tasks,
        registryModels: studioDraft.registryModels,
        createBackup: studioCreateBackup,
      }),
    onSuccess: (saved) => {
      const syncedDraft = {
        tasks: saved.tasks,
        registryModels: saved.registryModels,
      }
      setStudioDraftOverride(syncedDraft)
      setStudioBaselineOverride(syncedDraft)
      setStudioSaveError(null)
      pushNotice(
        'success',
        'Studio catalog saved',
        saved.backupPath ? `Backup created: ${saved.backupPath}` : 'Saved without backup',
      )
      queryClient.invalidateQueries({ queryKey: ['catalog-studio'] })
      queryClient.invalidateQueries({ queryKey: ['catalog'] })
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
      queryClient.invalidateQueries({ queryKey: ['ftp-registry-catalog-models'] })
    },
    onError: (error) => {
      const message = errorMessage(error)
      setStudioSaveError(message)
      pushNotice('error', 'Studio save failed', message)
    },
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
      queryClient.invalidateQueries({ queryKey: ['ftp-registry-catalog-models'] })
    },
    onError: (error) => pushNotice('error', 'Serving action failed', errorMessage(error)),
  })

  const isBusy =
    launchMutation.isPending ||
    stopMutation.isPending ||
    mlflowActionMutation.isPending ||
    servingMutation.isPending ||
    validateCatalogMutation.isPending ||
    formatCatalogMutation.isPending ||
    saveCatalogMutation.isPending ||
    saveCatalogStudioMutation.isPending

  const headline = useMemo(() => {
    const running = (runsQuery.data ?? []).filter((run) => run.status === 'running').length
    const finished = (runsQuery.data ?? []).filter((run) => run.status === 'completed').length
    return { running, finished }
  }, [runsQuery.data])

  useEffect(() => {
    syncViewToUrl(activeView)
  }, [activeView])

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(parseViewFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!(catalogDirty || studioDirty)) return undefined
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [catalogDirty, studioDirty])

  const handleViewChange = (nextView: AppView) => {
    if (nextView === activeView) return
    const hasUnsaved =
      (activeView === 'catalog' && catalogDirty) ||
      (activeView === 'studio' && studioDirty)
    if (hasUnsaved) {
      const shouldLeave = window.confirm('저장되지 않은 YAML 변경사항이 있습니다. 탭을 이동하시겠어요?')
      if (!shouldLeave) return
    }
    setActiveView(nextView)
  }

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

      <nav className="view-tabs" aria-label="Workspace tabs" role="tablist">
        <button
          id="tab-operations"
          role="tab"
          type="button"
          aria-selected={activeView === 'operations'}
          aria-controls="panel-operations"
          className={`view-tab ${activeView === 'operations' ? 'active' : ''}`}
          onClick={() => handleViewChange('operations')}
        >
          Operations
        </button>
        <button
          id="tab-catalog"
          role="tab"
          type="button"
          aria-selected={activeView === 'catalog'}
          aria-controls="panel-catalog"
          aria-label={`YAML Catalog${catalogDirty ? ' (unsaved changes)' : ''}`}
          className={`view-tab ${activeView === 'catalog' ? 'active' : ''}`}
          onClick={() => handleViewChange('catalog')}
        >
          YAML Catalog
          {catalogDirty ? ' •' : ''}
        </button>
        <button
          id="tab-studio"
          role="tab"
          type="button"
          aria-selected={activeView === 'studio'}
          aria-controls="panel-studio"
          aria-label={`YAML Studio${studioDirty ? ' (unsaved changes)' : ''}`}
          className={`view-tab ${activeView === 'studio' ? 'active' : ''}`}
          onClick={() => handleViewChange('studio')}
        >
          YAML Studio
          {studioDirty ? ' •' : ''}
        </button>
      </nav>

      <main id="main-content">
        {activeView === 'catalog' ? (
          <section id="panel-catalog" role="tabpanel" aria-labelledby="tab-catalog">
            <CatalogManagerPanel
              catalogPath={catalogQuery.data?.path ?? 'Loading…'}
              catalogExists={catalogQuery.data?.exists ?? true}
              modifiedAt={catalogQuery.data?.modifiedAt ?? null}
              validationState={catalogValidationState}
              validatedAt={catalogValidatedAt}
              value={catalogDraft}
              dirty={catalogDirty}
              createBackup={createBackup}
              isLoading={catalogQuery.isLoading}
              isValidating={validateCatalogMutation.isPending}
              isFormatting={formatCatalogMutation.isPending}
              isSaving={saveCatalogMutation.isPending}
              validationTaskCount={catalogTaskCount}
              validationTasks={catalogTasks}
              validationError={catalogValidationError}
              onValueChange={(nextValue) => {
                setCatalogDraftOverride(nextValue)
                setCatalogValidationError(null)
                setCatalogValidationState('idle')
              }}
              onCreateBackupChange={setCreateBackup}
              onValidate={() => validateCatalogMutation.mutate()}
              onFormat={() => formatCatalogMutation.mutate()}
              onSave={() => saveCatalogMutation.mutate()}
              onResetDraft={() => {
                setCatalogDraftOverride(catalogBaseline)
                setCatalogValidationError(null)
                setCatalogValidationState('idle')
              }}
              onReload={() => {
                setCatalogValidationError(null)
                setCatalogDraftOverride(null)
                setCatalogBaselineOverride(null)
                setCatalogValidation(null)
                setCatalogValidationState('idle')
                setCatalogValidatedAt(null)
                catalogQuery.refetch()
              }}
            />
          </section>
        ) : activeView === 'studio' ? (
          <section id="panel-studio" role="tabpanel" aria-labelledby="tab-studio">
            <CatalogStudioPanel
              catalogPath={catalogStudioQuery.data?.path ?? 'Loading…'}
              modifiedAt={catalogStudioQuery.data?.modifiedAt ?? null}
              tasks={studioDraft.tasks}
              registryModels={studioDraft.registryModels}
              dirty={studioDirty}
              createBackup={studioCreateBackup}
              isLoading={catalogStudioQuery.isLoading}
              isSaving={saveCatalogStudioMutation.isPending}
              saveError={studioSaveError}
              onCreateBackupChange={setStudioCreateBackup}
              onTasksChange={(nextTasks) => {
                setStudioSaveError(null)
                setStudioDraftOverride({
                  ...studioDraft,
                  tasks: nextTasks,
                })
              }}
              onRegistryModelsChange={(nextRegistryModels) => {
                setStudioSaveError(null)
                setStudioDraftOverride({
                  ...studioDraft,
                  registryModels: nextRegistryModels,
                })
              }}
              onSave={() => saveCatalogStudioMutation.mutate()}
              onResetDraft={() => {
                setStudioSaveError(null)
                setStudioDraftOverride(studioBaseline)
              }}
              onReload={() => {
                setStudioSaveError(null)
                setStudioDraftOverride(null)
                setStudioBaselineOverride(null)
                catalogStudioQuery.refetch()
              }}
            />
          </section>
        ) : (
          <section id="panel-operations" role="tabpanel" aria-labelledby="tab-operations" className="operations-panel">
            <LaunchPanel
              schemas={schemas}
              selectedTask={selectedTask}
              values={selectedValues}
              onTaskChange={(task) => {
                setSelectedTaskState(task)
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
              registryModels={registryModelsQuery.data ?? []}
              busy={isBusy}
              onDownloadFromMlflow={(payload) => servingMutation.mutate(() => api.downloadModelFromMlflow(payload))}
              onDownloadFromFtp={(payload) => servingMutation.mutate(() => api.downloadModelFromFtp(payload))}
              onDownloadRegistryModel={(payload) => servingMutation.mutate(() => api.downloadRegistryModel(payload))}
              onStartMlflowServing={(payload) => servingMutation.mutate(() => api.startMlflowServing(payload))}
              onStopMlflowServing={(serverId) => servingMutation.mutate(() => api.stopMlflowServing(serverId))}
              onLoadLocalModel={(payload) => servingMutation.mutate(() => api.loadLocalModel(payload))}
              onPublishFtpModel={(payload) => servingMutation.mutate(() => api.publishFtpModel(payload))}
              onPredict={(alias, inputs) => servingMutation.mutate(() => api.predictLocal(alias, inputs))}
            />
          </section>
        )}
      </main>

      <aside className="notice-stack" aria-live="polite" aria-relevant="additions text">
        {notices.map((notice) => (
          <article
            key={notice.timestamp}
            className={`notice ${notice.level}`}
            role={notice.level === 'error' ? 'alert' : 'status'}
          >
            <strong>{notice.message}</strong>
            {notice.detail ? <pre>{notice.detail}</pre> : null}
          </article>
        ))}
      </aside>
    </div>
  )
}
