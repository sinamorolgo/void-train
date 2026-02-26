import { useMemo, useState } from 'react'

import type { BaseTaskType, CatalogStudioRegistryModel, CatalogStudioTask } from '../types'
import { SectionCard } from './SectionCard'

interface CatalogStudioPanelProps {
  catalogPath: string
  modifiedAt: string | null
  tasks: CatalogStudioTask[]
  registryModels: CatalogStudioRegistryModel[]
  dirty: boolean
  createBackup: boolean
  isLoading: boolean
  isSaving: boolean
  saveError?: string | null
  onCreateBackupChange: (nextValue: boolean) => void
  onTasksChange: (nextTasks: CatalogStudioTask[]) => void
  onRegistryModelsChange: (nextRegistryModels: CatalogStudioRegistryModel[]) => void
  onSave: () => void
  onReload: () => void
  onResetDraft: () => void
}

function defaultTask(baseTaskType: BaseTaskType): CatalogStudioTask {
  if (baseTaskType === 'segmentation') {
    return {
      taskType: 'segmentation',
      enabled: true,
      title: 'Segmentation',
      description: 'Semantic segmentation trainer',
      baseTaskType: 'segmentation',
      runnerStartMethod: 'python_script',
      runnerTarget: 'backend/trainers/train_segmentation.py',
      runnerTargetEnvVar: 'SEGMENTATION_SCRIPT_PATH',
      runnerCwd: null,
      mlflowMetric: 'val_iou',
      mlflowMode: 'max',
      mlflowModelName: 'segmentation-best-model',
      mlflowArtifactPath: 'model',
      fieldOrder: ['run_name', 'dataset_root', 'epochs', 'mlflow_tracking_uri', 'mlflow_experiment'],
      hiddenFields: [],
      fieldOverrides: {
        run_name: { default: 'seg-quick-run' },
      },
    }
  }

  return {
    taskType: 'classification',
    enabled: true,
    title: 'Classification',
    description: 'Image classification trainer',
    baseTaskType: 'classification',
    runnerStartMethod: 'python_script',
    runnerTarget: 'backend/trainers/train_classification.py',
    runnerTargetEnvVar: 'CLASSIFICATION_SCRIPT_PATH',
    runnerCwd: null,
    mlflowMetric: 'val_accuracy',
    mlflowMode: 'max',
    mlflowModelName: 'classification-best-model',
    mlflowArtifactPath: 'model',
    fieldOrder: ['run_name', 'dataset_root', 'epochs', 'mlflow_tracking_uri', 'mlflow_experiment'],
    hiddenFields: [],
    fieldOverrides: {
      run_name: { default: 'clf-quick-run' },
    },
  }
}

function defaultRegistryModel(taskType: BaseTaskType): CatalogStudioRegistryModel {
  if (taskType === 'segmentation') {
    return {
      id: 'segmentation',
      title: 'Segmentation Model',
      description: 'Primary segmentation model line.',
      taskType: 'segmentation',
      modelName: 'segmentation-best-model',
      defaultStage: 'release',
      defaultVersion: 'latest',
      defaultDestinationDir: './backend/artifacts/downloads',
    }
  }
  return {
    id: 'classification',
    title: 'Classification Model',
    description: 'Primary classification model line.',
    taskType: 'classification',
    modelName: 'classification-best-model',
    defaultStage: 'release',
    defaultVersion: 'latest',
    defaultDestinationDir: './backend/artifacts/downloads',
  }
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function parseFieldOverridesValue(raw: string): Record<string, Record<string, unknown>> {
  const parsed = JSON.parse(raw || '{}') as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('fieldOverrides must be a JSON object')
  }
  return parsed as Record<string, Record<string, unknown>>
}

export function CatalogStudioPanel({
  catalogPath,
  modifiedAt,
  tasks,
  registryModels,
  dirty,
  createBackup,
  isLoading,
  isSaving,
  saveError,
  onCreateBackupChange,
  onTasksChange,
  onRegistryModelsChange,
  onSave,
  onReload,
  onResetDraft,
}: CatalogStudioPanelProps) {
  const [overridesTextByIndex, setOverridesTextByIndex] = useState<Record<number, string>>({})
  const [overrideErrors, setOverrideErrors] = useState<Record<number, string>>({})
  const [taskFilter, setTaskFilter] = useState('')
  const [expandedTaskIndexes, setExpandedTaskIndexes] = useState<Record<number, boolean>>({ 0: true })

  const validationIssues = useMemo(() => {
    const issues: string[] = []
    const taskTypeSet = new Set<string>()
    const registryIdSet = new Set<string>()

    tasks.forEach((task, index) => {
      const label = `Task #${index + 1}`
      if (!task.taskType.trim()) issues.push(`${label}: taskType is required`)
      if (!task.title.trim()) issues.push(`${label}: title is required`)
      if (!task.runnerTarget.trim()) issues.push(`${label}: runnerTarget is required`)
      if (!task.mlflowModelName.trim()) issues.push(`${label}: mlflowModelName is required`)

      const key = task.taskType.trim().toLowerCase()
      if (key) {
        if (taskTypeSet.has(key)) issues.push(`${label}: duplicated taskType '${task.taskType}'`)
        taskTypeSet.add(key)
      }
    })

    registryModels.forEach((model, index) => {
      const label = `Registry #${index + 1}`
      if (!model.id.trim()) issues.push(`${label}: id is required`)
      if (!model.modelName.trim()) issues.push(`${label}: modelName is required`)
      if (!model.title.trim()) issues.push(`${label}: title is required`)

      const key = model.id.trim().toLowerCase()
      if (key) {
        if (registryIdSet.has(key)) issues.push(`${label}: duplicated id '${model.id}'`)
        registryIdSet.add(key)
      }
    })

    return issues
  }, [registryModels, tasks])

  const overrideErrorCount = useMemo(() => Object.keys(overrideErrors).length, [overrideErrors])
  const overrideDraftMismatchCount = useMemo(() => {
    return Object.entries(overridesTextByIndex).filter(([indexText, text]) => {
      const index = Number(indexText)
      const task = tasks[index]
      if (!task) return false
      try {
        const parsed = parseFieldOverridesValue(text)
        return JSON.stringify(parsed) !== JSON.stringify(task.fieldOverrides)
      } catch {
        return true
      }
    }).length
  }, [overridesTextByIndex, tasks])
  const canSave =
    validationIssues.length === 0 &&
    overrideErrorCount === 0 &&
    overrideDraftMismatchCount === 0 &&
    !isSaving &&
    !isLoading &&
    tasks.length > 0
  const filteredTaskEntries = useMemo(
    () =>
      tasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => {
          const keyword = taskFilter.trim().toLowerCase()
          if (!keyword) return true
          return (
            task.taskType.toLowerCase().includes(keyword) ||
            task.title.toLowerCase().includes(keyword) ||
            task.baseTaskType.toLowerCase().includes(keyword)
          )
        }),
    [taskFilter, tasks],
  )

  const updateTask = (index: number, patch: Partial<CatalogStudioTask>) => {
    const next = tasks.map((task, taskIndex) => (taskIndex === index ? { ...task, ...patch } : task))
    onTasksChange(next)
  }

  const updateRegistryModel = (index: number, patch: Partial<CatalogStudioRegistryModel>) => {
    const next = registryModels.map((model, modelIndex) => (modelIndex === index ? { ...model, ...patch } : model))
    onRegistryModelsChange(next)
  }

  return (
    <SectionCard
      title="YAML Studio (Easy Mode)"
      subtitle="task/registry를 폼으로 관리하고 저장하면 training_catalog.yaml이 자동 갱신됩니다."
      action={
        <div className="catalog-actions">
          <button type="button" className="primary" onClick={onSave} disabled={!canSave}>
            {isSaving ? 'Saving…' : 'Save & Apply'}
          </button>
          <button type="button" onClick={onResetDraft} disabled={!dirty || isSaving}>
            Reset Draft
          </button>
          <button type="button" onClick={onReload} disabled={isSaving}>
            Reload
          </button>
        </div>
      }
    >
      <section className="studio-summary-grid">
        <article>
          <span>Catalog Path</span>
          <strong className="studio-path">{catalogPath}</strong>
        </article>
        <article>
          <span>Last Modified</span>
          <strong>{formatDate(modifiedAt)}</strong>
        </article>
        <article>
          <span>Tasks</span>
          <strong>{tasks.length}</strong>
        </article>
        <article>
          <span>Registry Models</span>
          <strong>{registryModels.length}</strong>
        </article>
      </section>

      <div className="catalog-tool-row">
        <label className="catalog-toggle" htmlFor="studio-backup">
          <input
            id="studio-backup"
            type="checkbox"
            checked={createBackup}
            onChange={(event) => onCreateBackupChange(event.target.checked)}
          />
          Save 전에 백업 파일 생성
        </label>
        <span className={dirty ? 'badge warn' : 'badge ok'}>{dirty ? 'Unsaved Changes' : 'In Sync'}</span>
        <span className="badge info">Validation: {validationIssues.length === 0 ? 'Ready' : `${validationIssues.length} issue(s)`}</span>
      </div>

      {validationIssues.length > 0 ? (
        <div className="catalog-inline-warning">
          <strong>Studio Validation</strong>
          <ul className="catalog-inline-warning-list">
            {validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {overrideErrorCount > 0 || overrideDraftMismatchCount > 0 ? (
        <div className="catalog-inline-warning">
          <strong>fieldOverrides 점검 필요</strong>
          <ul className="catalog-inline-warning-list">
            {overrideErrorCount > 0 ? <li>JSON 파싱 오류 {overrideErrorCount}개를 수정하세요.</li> : null}
            {overrideDraftMismatchCount > 0 ? (
              <li>수정한 fieldOverrides를 blur 처리(포커스 이동)해 반영한 뒤 저장하세요.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="catalog-error" role="alert">
          <p>{saveError}</p>
        </div>
      ) : null}

      <section className="studio-block">
        <header>
          <h4>Training Tasks</h4>
          <div className="catalog-builder-actions">
            <button type="button" onClick={() => onTasksChange([...tasks, defaultTask('classification')])}>
              + Classification
            </button>
            <button type="button" onClick={() => onTasksChange([...tasks, defaultTask('segmentation')])}>
              + Segmentation
            </button>
            <button
              type="button"
              onClick={() =>
                setExpandedTaskIndexes(
                  Object.fromEntries(tasks.map((_, index) => [index, true])) as Record<number, boolean>,
                )
              }
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() =>
                setExpandedTaskIndexes(
                  Object.fromEntries(tasks.map((_, index) => [index, false])) as Record<number, boolean>,
                )
              }
            >
              Collapse All
            </button>
          </div>
        </header>
        <div className="studio-filter-row">
          <label htmlFor="studio-task-filter">Filter tasks</label>
          <input
            id="studio-task-filter"
            type="text"
            autoComplete="off"
            value={taskFilter}
            placeholder="taskType / title"
            onChange={(event) => setTaskFilter(event.target.value)}
          />
          <span className="muted">
            Showing {filteredTaskEntries.length}/{tasks.length}
          </span>
        </div>
        {tasks.length === 0 ? <p className="empty">최소 1개 이상의 task가 필요합니다.</p> : null}
        <div className="studio-list">
          {filteredTaskEntries.map(({ task, index }) => (
            <article key={`${task.taskType}-${index}`} className={`studio-card ${expandedTaskIndexes[index] ? 'expanded' : 'collapsed'}`}>
              <div className="studio-card-head">
                <strong>
                  Task #{index + 1} · {task.taskType || 'new-task'}
                </strong>
                <div className="catalog-builder-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTaskIndexes((prev) => ({
                        ...prev,
                        [index]: !(prev[index] ?? index === 0),
                      }))
                    }
                  >
                    {(expandedTaskIndexes[index] ?? index === 0) ? 'Collapse' : 'Expand'}
                  </button>
                  <button type="button" onClick={() => onTasksChange([...tasks, { ...task, taskType: `${task.taskType}-copy` }])}>
                    Duplicate
                  </button>
                  <button type="button" onClick={() => onTasksChange(tasks.filter((_, i) => i !== index))} disabled={tasks.length <= 1}>
                    Remove
                  </button>
                </div>
              </div>
              {expandedTaskIndexes[index] ?? index === 0 ? (
                <>
                  <div className="compact-fields">
                <label>
                  taskType
                  <input value={task.taskType} onChange={(event) => updateTask(index, { taskType: event.target.value })} />
                </label>
                <label>
                  title
                  <input value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} />
                </label>
                <label>
                  description
                  <input value={task.description} onChange={(event) => updateTask(index, { description: event.target.value })} />
                </label>
                <label>
                  enabled
                  <select value={task.enabled ? 'true' : 'false'} onChange={(event) => updateTask(index, { enabled: event.target.value === 'true' })}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                <label>
                  baseTaskType
                  <select
                    value={task.baseTaskType}
                    onChange={(event) => updateTask(index, { baseTaskType: event.target.value as BaseTaskType })}
                  >
                    <option value="classification">classification</option>
                    <option value="segmentation">segmentation</option>
                  </select>
                </label>
                <label>
                  runnerStartMethod
                  <select
                    value={task.runnerStartMethod}
                    onChange={(event) => updateTask(index, { runnerStartMethod: event.target.value as 'python_script' | 'python_module' })}
                  >
                    <option value="python_script">python_script</option>
                    <option value="python_module">python_module</option>
                  </select>
                </label>
                <label>
                  runnerTarget
                  <input value={task.runnerTarget} onChange={(event) => updateTask(index, { runnerTarget: event.target.value })} />
                </label>
                <label>
                  runnerTargetEnvVar
                  <input
                    value={task.runnerTargetEnvVar ?? ''}
                    onChange={(event) => updateTask(index, { runnerTargetEnvVar: event.target.value || null })}
                  />
                </label>
                <label>
                  mlflowMetric
                  <input value={task.mlflowMetric} onChange={(event) => updateTask(index, { mlflowMetric: event.target.value })} />
                </label>
                <label>
                  mlflowMode
                  <select value={task.mlflowMode} onChange={(event) => updateTask(index, { mlflowMode: event.target.value as 'max' | 'min' })}>
                    <option value="max">max</option>
                    <option value="min">min</option>
                  </select>
                </label>
                <label>
                  mlflowModelName
                  <input
                    value={task.mlflowModelName}
                    onChange={(event) => updateTask(index, { mlflowModelName: event.target.value })}
                  />
                </label>
                <label>
                  mlflowArtifactPath
                  <input
                    value={task.mlflowArtifactPath}
                    onChange={(event) => updateTask(index, { mlflowArtifactPath: event.target.value })}
                  />
                </label>
                  </div>

                  <details className="studio-advanced">
                    <summary>Advanced Fields</summary>
                    <div className="compact-fields">
                      <label>
                        fieldOrder (comma-separated)
                        <textarea
                          rows={3}
                          value={task.fieldOrder.join(', ')}
                          onChange={(event) => updateTask(index, { fieldOrder: splitCsv(event.target.value) })}
                        />
                      </label>
                      <label>
                        hiddenFields (comma-separated)
                        <textarea
                          rows={3}
                          value={task.hiddenFields.join(', ')}
                          onChange={(event) => updateTask(index, { hiddenFields: splitCsv(event.target.value) })}
                        />
                      </label>
                      <label className="studio-overrides">
                        fieldOverrides (JSON object)
                        <textarea
                          rows={6}
                          value={overridesTextByIndex[index] ?? JSON.stringify(task.fieldOverrides, null, 2)}
                          onChange={(event) =>
                            setOverridesTextByIndex((prev) => ({
                              ...prev,
                              [index]: event.target.value,
                            }))
                          }
                          onBlur={(event) => {
                            try {
                              const parsed = parseFieldOverridesValue(event.target.value)
                              updateTask(index, { fieldOverrides: parsed })
                              setOverridesTextByIndex((prev) => ({
                                ...prev,
                                [index]: JSON.stringify(parsed, null, 2),
                              }))
                              setOverrideErrors((prev) => {
                                const next = { ...prev }
                                delete next[index]
                                return next
                              })
                            } catch (error) {
                              const detail = error instanceof Error ? error.message : 'JSON parse error'
                              setOverrideErrors((prev) => ({ ...prev, [index]: detail }))
                            }
                          }}
                        />
                        {overrideErrors[index] ? <small className="catalog-error-inline">{overrideErrors[index]}</small> : null}
                      </label>
                    </div>
                  </details>
                </>
              ) : (
                <p className="muted">
                  {task.title} · {task.baseTaskType} · {task.runnerStartMethod} · {task.runnerTarget}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="studio-block">
        <header>
          <h4>Registry Models</h4>
          <div className="catalog-builder-actions">
            <button type="button" onClick={() => onRegistryModelsChange([...registryModels, defaultRegistryModel('classification')])}>
              + Classification Model
            </button>
            <button type="button" onClick={() => onRegistryModelsChange([...registryModels, defaultRegistryModel('segmentation')])}>
              + Segmentation Model
            </button>
          </div>
        </header>
        <div className="studio-table-wrap">
          <table className="studio-table">
            <thead>
              <tr>
                <th scope="col">id</th>
                <th scope="col">title</th>
                <th scope="col">taskType</th>
                <th scope="col">modelName</th>
                <th scope="col">stage</th>
                <th scope="col">version</th>
                <th scope="col">destination</th>
                <th scope="col">actions</th>
              </tr>
            </thead>
            <tbody>
              {registryModels.map((model, index) => (
                <tr key={`${model.id}-${index}`}>
                  <td>
                    <input value={model.id} onChange={(event) => updateRegistryModel(index, { id: event.target.value })} />
                  </td>
                  <td>
                    <input value={model.title} onChange={(event) => updateRegistryModel(index, { title: event.target.value })} />
                  </td>
                  <td>
                    <select
                      value={model.taskType}
                      onChange={(event) => updateRegistryModel(index, { taskType: event.target.value as BaseTaskType })}
                    >
                      <option value="classification">classification</option>
                      <option value="segmentation">segmentation</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={model.modelName}
                      onChange={(event) => updateRegistryModel(index, { modelName: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={model.defaultStage}
                      onChange={(event) => updateRegistryModel(index, { defaultStage: event.target.value as 'dev' | 'release' })}
                    >
                      <option value="dev">dev</option>
                      <option value="release">release</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={model.defaultVersion}
                      onChange={(event) => updateRegistryModel(index, { defaultVersion: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={model.defaultDestinationDir}
                      onChange={(event) => updateRegistryModel(index, { defaultDestinationDir: event.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onRegistryModelsChange(registryModels.filter((_, modelIndex) => modelIndex !== index))}
                      disabled={registryModels.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </SectionCard>
  )
}
