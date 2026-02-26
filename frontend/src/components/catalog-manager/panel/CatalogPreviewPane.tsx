import type { BuilderDraft } from '../catalogManagerUtils'
import type {
  PreviewTab,
  SharedPreviewActions,
  SharedPreviewRuntime,
  SharedPreviewState,
  StudioDraftActions,
} from './types'
import { BuilderPreviewTab } from './tabs/BuilderPreviewTab'
import { MatrixPreviewTab } from './tabs/MatrixPreviewTab'
import { NavigatorPreviewTab } from './tabs/NavigatorPreviewTab'
import { StudioPreviewTab } from './tabs/StudioPreviewTab'
import { ValidatedPreviewTab } from './tabs/ValidatedPreviewTab'
import { WorkspacePreviewTab } from './tabs/WorkspacePreviewTab'

interface CatalogPreviewPaneProps {
  previewTab: PreviewTab
  onPreviewTabChange: (tab: PreviewTab) => void
  state: SharedPreviewState
  actions: SharedPreviewActions
  studioActions: StudioDraftActions
  runtime: SharedPreviewRuntime
  builder: BuilderDraft
}

export function CatalogPreviewPane({
  previewTab,
  onPreviewTabChange,
  state,
  actions,
  studioActions,
  runtime,
  builder,
}: CatalogPreviewPaneProps) {
  return (
    <aside className="catalog-preview" aria-live="polite">
      <h3>Task Preview</h3>
      <p>{state.taskCountLabel}</p>
      <nav className="catalog-preview-tabs" aria-label="YAML helper tabs">
        <button
          type="button"
          className={previewTab === 'workspace' ? 'active' : ''}
          onClick={() => onPreviewTabChange('workspace')}
          aria-pressed={previewTab === 'workspace'}
        >
          Workspace
        </button>
        <button
          type="button"
          className={previewTab === 'navigator' ? 'active' : ''}
          onClick={() => onPreviewTabChange('navigator')}
          aria-pressed={previewTab === 'navigator'}
        >
          Navigator
        </button>
        <button
          type="button"
          className={previewTab === 'matrix' ? 'active' : ''}
          onClick={() => onPreviewTabChange('matrix')}
          aria-pressed={previewTab === 'matrix'}
        >
          Task Matrix
        </button>
        <button
          type="button"
          className={previewTab === 'studio' ? 'active' : ''}
          onClick={() => onPreviewTabChange('studio')}
          aria-pressed={previewTab === 'studio'}
        >
          YAML Studio
        </button>
        <button
          type="button"
          className={previewTab === 'builder' ? 'active' : ''}
          onClick={() => onPreviewTabChange('builder')}
          aria-pressed={previewTab === 'builder'}
        >
          Block Builder
        </button>
        <button
          type="button"
          className={previewTab === 'validated' ? 'active' : ''}
          onClick={() => onPreviewTabChange('validated')}
          aria-pressed={previewTab === 'validated'}
        >
          Validated Tasks
        </button>
      </nav>

      {previewTab === 'workspace' ? (
        <WorkspacePreviewTab
          taskOutline={state.taskOutline}
          duplicatedOutlineTaskTypes={state.duplicatedOutlineTaskTypes}
          validatedTaskMap={state.validatedTaskMap}
          validationTaskCount={state.validationTaskCount}
          enabledStudioTaskCount={state.enabledStudioTaskCount}
          studioTaskCount={state.studioTasks.length}
          dirty={state.dirty}
          validationBadgeLabel={state.validationBadge.label}
          onJumpToOffset={actions.onJumpToOffset}
          onImportStudioTasksFromEditor={actions.onImportStudioTasksFromEditor}
          onValidate={actions.onValidate}
          onFormat={actions.onFormat}
          onSave={actions.onSave}
          isLoading={runtime.isLoading}
          isSaving={runtime.isSaving}
          isValidating={runtime.isValidating}
          isFormatting={runtime.isFormatting}
        />
      ) : null}

      {previewTab === 'navigator' ? (
        <NavigatorPreviewTab taskOutline={state.taskOutline} onJumpToOffset={actions.onJumpToOffset} />
      ) : null}

      {previewTab === 'matrix' ? (
        <MatrixPreviewTab
          studioTasks={state.studioTasks}
          studioStatus={state.studioStatus}
          enabledStudioTaskCount={state.enabledStudioTaskCount}
          studioIssues={state.studioIssues}
          studioIsValid={state.studioIsValid}
          onAddStudioTask={studioActions.addStudioTask}
          onSortStudioTasksByTaskType={studioActions.sortStudioTasksByTaskType}
          onResetStudioTasks={studioActions.resetStudioTasks}
          onImportStudioTasksFromEditor={actions.onImportStudioTasksFromEditor}
          onReplaceEditorWithStudioYaml={actions.onReplaceEditorWithStudioYaml}
          onAppendStudioTasks={actions.onAppendStudioTasks}
          onUpdateStudioTask={studioActions.updateStudioTask}
          onUpdateStudioBaseTask={studioActions.updateStudioBaseTask}
          onMoveStudioTask={studioActions.moveStudioTask}
          onDuplicateStudioTask={studioActions.duplicateStudioTask}
          onRemoveStudioTask={studioActions.removeStudioTask}
        />
      ) : null}

      {previewTab === 'studio' ? (
        <StudioPreviewTab
          studioTasks={state.studioTasks}
          studioStatus={state.studioStatus}
          studioReadyLabel={state.studioReadyLabel}
          studioIsValid={state.studioIsValid}
          studioIssues={state.studioIssues}
          duplicatedStudioTaskTypes={state.duplicatedStudioTaskTypes}
          onAddStudioTask={studioActions.addStudioTask}
          onSortStudioTasksByTaskType={studioActions.sortStudioTasksByTaskType}
          onResetStudioTasks={studioActions.resetStudioTasks}
          onImportStudioTasksFromEditor={actions.onImportStudioTasksFromEditor}
          onReplaceEditorWithStudioYaml={actions.onReplaceEditorWithStudioYaml}
          onAppendStudioTasks={actions.onAppendStudioTasks}
          onDownloadStudioYaml={actions.onDownloadStudioYaml}
          onUpdateStudioTask={studioActions.updateStudioTask}
          onUpdateStudioBaseTask={studioActions.updateStudioBaseTask}
          onMoveStudioTask={studioActions.moveStudioTask}
          onDuplicateStudioTask={studioActions.duplicateStudioTask}
          onRemoveStudioTask={studioActions.removeStudioTask}
          studioCatalogSnippet={state.studioCatalogSnippet}
        />
      ) : null}

      {previewTab === 'builder' ? (
        <BuilderPreviewTab
          builder={builder}
          formattedTaskSnippet={state.formattedTaskSnippet}
          onUpdateBuilderBaseTask={actions.onUpdateBuilderBaseTask}
          onBuilderChange={actions.onBuilderChange}
          onInsertFormattedTaskSnippetAtCursor={actions.onInsertFormattedTaskSnippetAtCursor}
          onAppendFormattedTaskSnippet={actions.onAppendFormattedTaskSnippet}
        />
      ) : null}

      {previewTab === 'validated' ? <ValidatedPreviewTab validationTasks={state.validationTasks} /> : null}
    </aside>
  )
}
