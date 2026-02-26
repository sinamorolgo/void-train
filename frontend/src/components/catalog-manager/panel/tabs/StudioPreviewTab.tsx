import type { BaseTaskType } from '../../../../types'
import type { BuilderDraft, StudioIssue } from '../../catalogManagerUtils'

interface StudioPreviewTabProps {
  studioTasks: BuilderDraft[]
  studioStatus: string | null
  studioReadyLabel: string
  studioIsValid: boolean
  studioIssues: StudioIssue[]
  duplicatedStudioTaskTypes: string[]
  onAddStudioTask: (baseTaskType: BaseTaskType) => void
  onSortStudioTasksByTaskType: () => void
  onResetStudioTasks: () => void
  onImportStudioTasksFromEditor: () => void
  onReplaceEditorWithStudioYaml: () => void
  onAppendStudioTasks: () => void
  onDownloadStudioYaml: () => void
  onUpdateStudioTask: (index: number, patch: Partial<BuilderDraft>) => void
  onUpdateStudioBaseTask: (index: number, baseTaskType: BaseTaskType) => void
  onMoveStudioTask: (index: number, direction: -1 | 1) => void
  onDuplicateStudioTask: (index: number) => void
  onRemoveStudioTask: (index: number) => void
  studioCatalogSnippet: string
}

export function StudioPreviewTab({
  studioTasks,
  studioStatus,
  studioReadyLabel,
  studioIsValid,
  studioIssues,
  duplicatedStudioTaskTypes,
  onAddStudioTask,
  onSortStudioTasksByTaskType,
  onResetStudioTasks,
  onImportStudioTasksFromEditor,
  onReplaceEditorWithStudioYaml,
  onAppendStudioTasks,
  onDownloadStudioYaml,
  onUpdateStudioTask,
  onUpdateStudioBaseTask,
  onMoveStudioTask,
  onDuplicateStudioTask,
  onRemoveStudioTask,
  studioCatalogSnippet,
}: StudioPreviewTabProps) {
  return (
    <section className="catalog-studio">
      <h4>YAML Studio</h4>
      <p>
        task 폼으로 `training_catalog.yaml` 전체를 생성합니다. raw YAML을 직접 편집하지 않아도 task 리스트를 빠르게
        교체할 수 있습니다.
      </p>
      <div className="catalog-builder-actions">
        <button type="button" onClick={() => onAddStudioTask('classification')}>
          + Classification Task
        </button>
        <button type="button" onClick={() => onAddStudioTask('segmentation')}>
          + Segmentation Task
        </button>
        <button type="button" onClick={onSortStudioTasksByTaskType}>
          Sort by taskType
        </button>
        <button type="button" onClick={onResetStudioTasks}>
          Reset Studio
        </button>
      </div>
      <div className="catalog-builder-actions">
        <button type="button" onClick={onImportStudioTasksFromEditor}>
          Load from Editor YAML
        </button>
        <button type="button" onClick={onReplaceEditorWithStudioYaml} disabled={!studioIsValid}>
          Replace Editor YAML
        </button>
        <button type="button" onClick={onAppendStudioTasks} disabled={!studioIsValid}>
          Append Studio Tasks
        </button>
        <button type="button" onClick={onDownloadStudioYaml} disabled={!studioIsValid}>
          Download Studio YAML
        </button>
      </div>
      {duplicatedStudioTaskTypes.length > 0 ? (
        <p className="catalog-inline-warning">
          Duplicated taskType: {duplicatedStudioTaskTypes.join(', ')}. 저장 전에 taskType을 고유하게 맞춰주세요.
        </p>
      ) : null}
      {!studioIsValid ? (
        <div className="catalog-inline-warning">
          <strong>Studio Validation</strong>
          <ul className="catalog-inline-warning-list">
            {studioIssues.map((issue) => (
              <li key={issue.key}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="muted">{studioStatus ?? studioReadyLabel}</p>
      <div className="catalog-studio-list">
        {studioTasks.map((draft, index) => (
          <article key={`${draft.baseTaskType}-${index}`} className="catalog-studio-task">
            <header>
              <strong>Task #{index + 1}</strong>
              <div className="catalog-studio-task-actions">
                <button type="button" onClick={() => onMoveStudioTask(index, -1)} disabled={index === 0}>
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => onMoveStudioTask(index, 1)}
                  disabled={index === studioTasks.length - 1}
                >
                  Down
                </button>
                <button type="button" onClick={() => onDuplicateStudioTask(index)}>
                  Duplicate
                </button>
                <button type="button" onClick={() => onRemoveStudioTask(index)} disabled={studioTasks.length <= 1}>
                  Remove
                </button>
              </div>
            </header>
            <div className="compact-fields">
              <label>
                taskType
                <input
                  name={`studio_task_type_${index}`}
                  autoComplete="off"
                  value={draft.taskType}
                  onChange={(event) => onUpdateStudioTask(index, { taskType: event.target.value })}
                />
              </label>
              <label>
                title
                <input
                  name={`studio_title_${index}`}
                  autoComplete="off"
                  value={draft.title}
                  onChange={(event) => onUpdateStudioTask(index, { title: event.target.value })}
                />
              </label>
              <label>
                description
                <input
                  name={`studio_description_${index}`}
                  autoComplete="off"
                  value={draft.description}
                  onChange={(event) => onUpdateStudioTask(index, { description: event.target.value })}
                />
              </label>
              <label>
                enabled
                <select
                  name={`studio_enabled_${index}`}
                  value={draft.enabled ? 'true' : 'false'}
                  onChange={(event) => onUpdateStudioTask(index, { enabled: event.target.value === 'true' })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <label>
                baseTaskType
                <select
                  name={`studio_base_task_type_${index}`}
                  value={draft.baseTaskType}
                  onChange={(event) => onUpdateStudioBaseTask(index, event.target.value as BaseTaskType)}
                >
                  <option value="classification">classification</option>
                  <option value="segmentation">segmentation</option>
                </select>
              </label>
              <label>
                runner.target
                <input
                  name={`studio_runner_target_${index}`}
                  autoComplete="off"
                  value={draft.runnerTarget}
                  onChange={(event) => onUpdateStudioTask(index, { runnerTarget: event.target.value })}
                />
              </label>
              <label>
                mlflow.metric
                <input
                  name={`studio_metric_${index}`}
                  autoComplete="off"
                  value={draft.metric}
                  onChange={(event) => onUpdateStudioTask(index, { metric: event.target.value })}
                />
              </label>
              <label>
                mlflow.mode
                <select
                  name={`studio_mode_${index}`}
                  value={draft.mode}
                  onChange={(event) => onUpdateStudioTask(index, { mode: event.target.value as 'max' | 'min' })}
                >
                  <option value="max">max</option>
                  <option value="min">min</option>
                </select>
              </label>
            </div>
          </article>
        ))}
      </div>
      <details className="catalog-snippet-preview">
        <summary>Preview Generated Catalog</summary>
        <pre>{studioCatalogSnippet}</pre>
      </details>
    </section>
  )
}
