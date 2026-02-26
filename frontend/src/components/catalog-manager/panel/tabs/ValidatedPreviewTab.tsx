import type { CatalogTaskSummary } from '../../../../types'

interface ValidatedPreviewTabProps {
  validationTasks: CatalogTaskSummary[]
}

export function ValidatedPreviewTab({ validationTasks }: ValidatedPreviewTabProps) {
  if (validationTasks.length === 0) {
    return (
      <div className="catalog-task-list">
        <p className="empty">No validated tasks yet.</p>
      </div>
    )
  }

  return (
    <div className="catalog-task-list">
      {validationTasks.map((task) => (
        <article key={task.taskType} className="catalog-task">
          <header>
            <strong>{task.title}</strong>
            <span>{task.baseTaskType}</span>
          </header>
          <dl>
            <dt>taskType</dt>
            <dd>{task.taskType}</dd>
            <dt>runner</dt>
            <dd>
              {task.runnerStartMethod} · {task.runnerTarget}
            </dd>
            <dt>field order</dt>
            <dd>{task.fieldOrderCount}</dd>
            <dt>field overrides</dt>
            <dd>{task.fieldOverrideCount}</dd>
          </dl>
        </article>
      ))}
    </div>
  )
}
