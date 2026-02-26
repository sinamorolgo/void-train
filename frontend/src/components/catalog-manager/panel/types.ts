import type { ChangeEvent } from 'react'

import type { BaseTaskType, CatalogTaskSummary } from '../../../types'
import type { BuilderDraft, StarterPreset, StudioIssue, TaskOutlineItem } from '../catalogManagerUtils'

export type PreviewTab = 'workspace' | 'navigator' | 'matrix' | 'studio' | 'builder' | 'validated'

export interface ValidationBadge {
  label: string
  className: 'ok' | 'warn' | 'info'
  detail: string
}

export interface StudioDraftActions {
  updateStudioTask: (index: number, patch: Partial<BuilderDraft>) => void
  updateStudioBaseTask: (index: number, nextBaseTaskType: BaseTaskType) => void
  addStudioTask: (baseTaskType: BaseTaskType) => void
  duplicateStudioTask: (index: number) => void
  moveStudioTask: (index: number, direction: -1 | 1) => void
  sortStudioTasksByTaskType: () => void
  removeStudioTask: (index: number) => void
  resetStudioTasks: () => void
}

export interface SharedPreviewState {
  value: string
  dirty: boolean
  taskOutline: TaskOutlineItem[]
  duplicatedOutlineTaskTypes: string[]
  validationTasks: CatalogTaskSummary[]
  validatedTaskMap: Map<string, CatalogTaskSummary>
  validationTaskCount: number | null
  validationBadge: ValidationBadge
  enabledStudioTaskCount: number
  studioTasks: BuilderDraft[]
  studioStatus: string | null
  duplicatedStudioTaskTypes: string[]
  studioIssues: StudioIssue[]
  studioIsValid: boolean
  studioReadyLabel: string
  formattedTaskSnippet: string
  studioCatalogSnippet: string
  taskCountLabel: string
}

export interface SharedPreviewActions {
  onJumpToOffset: (offset: number) => void
  onImportStudioTasksFromEditor: () => void
  onValidate: () => void
  onFormat: () => void
  onSave: () => void
  onReplaceEditorWithStudioYaml: () => void
  onAppendStudioTasks: () => void
  onDownloadStudioYaml: () => void
  onInsertFormattedTaskSnippetAtCursor: () => void
  onAppendFormattedTaskSnippet: () => void
  onUpdateBuilderBaseTask: (baseTaskType: BaseTaskType) => void
  onBuilderChange: (patch: Partial<BuilderDraft>) => void
}

export interface SharedPreviewRuntime {
  isLoading: boolean
  isSaving: boolean
  isValidating: boolean
  isFormatting: boolean
}

export interface EditorPanelActions {
  onCreateBackupChange: (checked: boolean) => void
  onWordWrapChange: (checked: boolean) => void
  onStarterPresetChange: (preset: StarterPreset) => void
  onApplyStarterPreset: () => void
  onReplaceWithTemplate: () => void
  onJumpToTop: () => void
  onJumpToEnd: () => void
  onInsertClassificationTask: () => void
  onInsertSegmentationTask: () => void
  onOpenImportPicker: () => void
  onImportYaml: (event: ChangeEvent<HTMLInputElement>) => void
  onExportYaml: () => void
  onCopyYamlToClipboard: () => void
  onFindTextChange: (text: string) => void
  onFindNext: () => void
  onValueChange: (value: string) => void
  onJumpToValidationLine: () => void
}
