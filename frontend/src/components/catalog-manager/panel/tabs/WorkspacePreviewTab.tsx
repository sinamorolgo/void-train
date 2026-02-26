import type { CatalogTaskSummary } from '../../../../types'
import type { TaskOutlineItem } from '../../catalogManagerUtils'

interface WorkspacePreviewTabProps {
  taskOutline: TaskOutlineItem[]
  duplicatedOutlineTaskTypes: string[]
  validatedTaskMap: Map<string, CatalogTaskSummary>
  validationTaskCount: number | null
  enabledStudioTaskCount: number
  studioTaskCount: number
  dirty: boolean
  validationBadgeLabel: string
  onJumpToOffset: (offset: number) => void
  onImportStudioTasksFromEditor: () => void
  onValidate: () => void
  onFormat: () => void
  onSave: () => void
  isLoading: boolean
  isSaving: boolean
  isValidating: boolean
  isFormatting: boolean
}

export function WorkspacePreviewTab({
  taskOutline,
  duplicatedOutlineTaskTypes,
  validatedTaskMap,
  validationTaskCount,
  enabledStudioTaskCount,
  studioTaskCount,
  dirty,
  validationBadgeLabel,
  onJumpToOffset,
  onImportStudioTasksFromEditor,
  onValidate,
  onFormat,
  onSave,
  isLoading,
  isSaving,
  isValidating,
  isFormatting,
}: WorkspacePreviewTabProps) {
  return (
    <section className="catalog-workspace">
      <h4>YAML Workspace</h4>
      <p>
        전체 YAML 상태를 한 번에 확인하고 필요한 작업(검증/정렬/저장)을 바로 실행할 수 있는 운영 탭입니다.
      </p>
      <div className="catalog-workspace-grid">
        <article>
          <span>Editor Tasks</span>
          <strong>{taskOutline.length}</strong>
        </article>
        <article>
          <span>Enabled Tasks</span>
          <strong>
            {enabledStudioTaskCount}/{studioTaskCount}
          </strong>
        </article>
        <article>
          <span>Validated Tasks</span>
          <strong>{validationTaskCount ?? '-'}</strong>
        </article>
        <article>
          <span>Unsaved</span>
          <strong>{dirty ? 'Yes' : 'No'}</strong>
        </article>
        <article>
          <span>Schema</span>
          <strong>{validationBadgeLabel}</strong>
        </article>
      </div>
      <div className="catalog-builder-actions">
        <button type="button" onClick={onImportStudioTasksFromEditor}>
          Sync Studio from YAML
        </button>
        <button type="button" onClick={onValidate} disabled={isValidating || isLoading}>
          Validate Now
        </button>
        <button type="button" onClick={onFormat} disabled={isFormatting || isLoading}>
          Format YAML
        </button>
        <button type="button" onClick={onSave} disabled={isSaving || isLoading}>
          Save & Apply
        </button>
      </div>
      {duplicatedOutlineTaskTypes.length > 0 ? (
        <p className="catalog-inline-warning">
          Duplicated taskType detected: {duplicatedOutlineTaskTypes.join(', ')}
        </p>
      ) : null}
      {taskOutline.length === 0 ? (
        <p className="empty">`- taskType:` 블록을 찾지 못했습니다. Starter Preset으로 시작해 보세요.</p>
      ) : (
        <div className="catalog-workspace-table-wrap">
          <table className="catalog-workspace-table">
            <thead>
              <tr>
                <th scope="col">taskType</th>
                <th scope="col">line</th>
                <th scope="col">validated</th>
                <th scope="col">runner</th>
                <th scope="col">action</th>
              </tr>
            </thead>
            <tbody>
              {taskOutline.map((item) => {
                const validated = validatedTaskMap.get(item.taskType)
                return (
                  <tr key={`${item.taskType}-${item.line}`}>
                    <td>{item.taskType}</td>
                    <td>{item.line}</td>
                    <td>{validated ? validated.baseTaskType : '-'}</td>
                    <td>{validated ? validated.runnerTarget : '-'}</td>
                    <td>
                      <button type="button" className="outline-jump" onClick={() => onJumpToOffset(item.offset)}>
                        Jump
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
