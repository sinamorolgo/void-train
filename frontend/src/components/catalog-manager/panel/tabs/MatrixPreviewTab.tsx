import type { BaseTaskType } from '../../../../types'
import type { BuilderDraft, StudioIssue } from '../../catalogManagerUtils'

interface MatrixPreviewTabProps {
  studioTasks: BuilderDraft[]
  studioStatus: string | null
  enabledStudioTaskCount: number
  studioIssues: StudioIssue[]
  studioIsValid: boolean
  onAddStudioTask: (baseTaskType: BaseTaskType) => void
  onSortStudioTasksByTaskType: () => void
  onResetStudioTasks: () => void
  onImportStudioTasksFromEditor: () => void
  onReplaceEditorWithStudioYaml: () => void
  onAppendStudioTasks: () => void
  onUpdateStudioTask: (index: number, patch: Partial<BuilderDraft>) => void
  onUpdateStudioBaseTask: (index: number, baseTaskType: BaseTaskType) => void
  onMoveStudioTask: (index: number, direction: -1 | 1) => void
  onDuplicateStudioTask: (index: number) => void
  onRemoveStudioTask: (index: number) => void
}

export function MatrixPreviewTab({
  studioTasks,
  studioStatus,
  enabledStudioTaskCount,
  studioIssues,
  studioIsValid,
  onAddStudioTask,
  onSortStudioTasksByTaskType,
  onResetStudioTasks,
  onImportStudioTasksFromEditor,
  onReplaceEditorWithStudioYaml,
  onAppendStudioTasks,
  onUpdateStudioTask,
  onUpdateStudioBaseTask,
  onMoveStudioTask,
  onDuplicateStudioTask,
  onRemoveStudioTask,
}: MatrixPreviewTabProps) {
  return (
    <section className="catalog-matrix">
      <h4>Task Matrix Editor</h4>
      <p>
        YAML을 직접 편집하지 않아도 task별 핵심 필드(enabled, title, description, runner, metric)를 표로 빠르게
        관리할 수 있습니다.
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
          Reset
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
          Append Tasks
        </button>
      </div>
      {!studioIsValid ? (
        <div className="catalog-inline-warning">
          <strong>Matrix Validation</strong>
          <ul className="catalog-inline-warning-list">
            {studioIssues.map((issue) => (
              <li key={issue.key}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="catalog-matrix-wrap">
        <table className="catalog-matrix-table">
          <thead>
            <tr>
              <th scope="col">enabled</th>
              <th scope="col">taskType</th>
              <th scope="col">title</th>
              <th scope="col">description</th>
              <th scope="col">base</th>
              <th scope="col">runner.target</th>
              <th scope="col">mlflow.metric</th>
              <th scope="col">mode</th>
              <th scope="col">actions</th>
            </tr>
          </thead>
          <tbody>
            {studioTasks.map((draft, index) => (
              <tr key={`matrix-${index}-${draft.taskType}`}>
                <td>
                  <input
                    name={`matrix_enabled_${index}`}
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => onUpdateStudioTask(index, { enabled: event.target.checked })}
                    aria-label={`Enable task ${index + 1}`}
                  />
                </td>
                <td>
                  <input
                    name={`matrix_task_type_${index}`}
                    value={draft.taskType}
                    onChange={(event) => onUpdateStudioTask(index, { taskType: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    name={`matrix_title_${index}`}
                    value={draft.title}
                    onChange={(event) => onUpdateStudioTask(index, { title: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    name={`matrix_description_${index}`}
                    value={draft.description}
                    onChange={(event) => onUpdateStudioTask(index, { description: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    name={`matrix_base_task_type_${index}`}
                    value={draft.baseTaskType}
                    onChange={(event) => onUpdateStudioBaseTask(index, event.target.value as BaseTaskType)}
                  >
                    <option value="classification">classification</option>
                    <option value="segmentation">segmentation</option>
                  </select>
                </td>
                <td>
                  <input
                    name={`matrix_runner_target_${index}`}
                    value={draft.runnerTarget}
                    onChange={(event) => onUpdateStudioTask(index, { runnerTarget: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    name={`matrix_metric_${index}`}
                    value={draft.metric}
                    onChange={(event) => onUpdateStudioTask(index, { metric: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    name={`matrix_mode_${index}`}
                    value={draft.mode}
                    onChange={(event) => onUpdateStudioTask(index, { mode: event.target.value as 'max' | 'min' })}
                  >
                    <option value="max">max</option>
                    <option value="min">min</option>
                  </select>
                </td>
                <td>
                  <div className="catalog-matrix-actions">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{studioStatus ?? `Enabled ${enabledStudioTaskCount}/${studioTasks.length} tasks in matrix.`}</p>
    </section>
  )
}
