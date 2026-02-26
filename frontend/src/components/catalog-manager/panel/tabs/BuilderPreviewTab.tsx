import type { BaseTaskType } from '../../../../types'
import type { BuilderDraft } from '../../catalogManagerUtils'

interface BuilderPreviewTabProps {
  builder: BuilderDraft
  formattedTaskSnippet: string
  onUpdateBuilderBaseTask: (baseTaskType: BaseTaskType) => void
  onBuilderChange: (patch: Partial<BuilderDraft>) => void
  onInsertFormattedTaskSnippetAtCursor: () => void
  onAppendFormattedTaskSnippet: () => void
}

export function BuilderPreviewTab({
  builder,
  formattedTaskSnippet,
  onUpdateBuilderBaseTask,
  onBuilderChange,
  onInsertFormattedTaskSnippetAtCursor,
  onAppendFormattedTaskSnippet,
}: BuilderPreviewTabProps) {
  return (
    <section className="catalog-builder">
      <h4>Task Block Builder</h4>
      <p>새 task 블록을 YAML 스니펫으로 생성해 커서 위치 또는 파일 끝에 넣을 수 있습니다.</p>
      <div className="compact-fields">
        <label>
          taskType
          <input
            name="builder_task_type"
            autoComplete="off"
            value={builder.taskType}
            onChange={(event) => onBuilderChange({ taskType: event.target.value })}
          />
        </label>
        <label>
          title
          <input
            name="builder_title"
            autoComplete="off"
            value={builder.title}
            onChange={(event) => onBuilderChange({ title: event.target.value })}
          />
        </label>
        <label>
          description
          <input
            name="builder_description"
            autoComplete="off"
            value={builder.description}
            onChange={(event) => onBuilderChange({ description: event.target.value })}
          />
        </label>
        <label>
          enabled
          <select
            name="builder_enabled"
            value={builder.enabled ? 'true' : 'false'}
            onChange={(event) => onBuilderChange({ enabled: event.target.value === 'true' })}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
        <label>
          baseTaskType
          <select
            name="builder_base_task_type"
            value={builder.baseTaskType}
            onChange={(event) => onUpdateBuilderBaseTask(event.target.value as BaseTaskType)}
          >
            <option value="classification">classification</option>
            <option value="segmentation">segmentation</option>
          </select>
        </label>
        <label>
          runner.target
          <input
            name="builder_runner_target"
            autoComplete="off"
            value={builder.runnerTarget}
            onChange={(event) => onBuilderChange({ runnerTarget: event.target.value })}
          />
        </label>
        <label>
          mlflow.metric
          <input
            name="builder_metric"
            autoComplete="off"
            value={builder.metric}
            onChange={(event) => onBuilderChange({ metric: event.target.value })}
          />
        </label>
        <label>
          mlflow.mode
          <select
            name="builder_mode"
            value={builder.mode}
            onChange={(event) => onBuilderChange({ mode: event.target.value as 'max' | 'min' })}
          >
            <option value="max">max</option>
            <option value="min">min</option>
          </select>
        </label>
      </div>
      <div className="catalog-builder-actions">
        <button type="button" onClick={onInsertFormattedTaskSnippetAtCursor}>
          Insert at Cursor
        </button>
        <button type="button" onClick={onAppendFormattedTaskSnippet}>
          Append to End
        </button>
      </div>
      <details className="catalog-snippet-preview">
        <summary>Preview Generated Snippet</summary>
        <pre>{formattedTaskSnippet}</pre>
      </details>
    </section>
  )
}
