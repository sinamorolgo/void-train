import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import type { BaseTaskType, CatalogTaskSummary } from '../types'
import {
  appendBlock,
  buildCatalogSnippet,
  buildTaskBlockSnippet,
  buildTaskSnippet,
  collectStudioIssues,
  defaultBuilderDraft,
  findDuplicateTaskTypes,
  formatDate,
  getStarterTemplate,
  offsetForLine,
  parseLineNumberFromError,
  parseStudioTasksFromYaml,
  parseTaskOutline,
  studioDraftsForPreset,
  switchBuilderBaseTask,
} from './catalog-manager/catalogManagerUtils'
import type { BuilderDraft, StarterPreset } from './catalog-manager/catalogManagerUtils'
import { useCatalogStudioDrafts } from './catalog-manager/useCatalogStudioDrafts'
import { CatalogEditorPane } from './catalog-manager/panel/CatalogEditorPane'
import { CatalogPreviewPane } from './catalog-manager/panel/CatalogPreviewPane'
import { CatalogQuickFlow } from './catalog-manager/panel/CatalogQuickFlow'
import type {
  EditorPanelActions,
  PreviewTab,
  SharedPreviewActions,
  SharedPreviewRuntime,
  SharedPreviewState,
  StudioDraftActions,
} from './catalog-manager/panel/types'
import { SectionCard } from './SectionCard'

export interface CatalogManagerPanelProps {
  catalogPath: string
  catalogExists: boolean
  modifiedAt: string | null
  validationState: 'idle' | 'valid' | 'invalid'
  validatedAt: string | null
  value: string
  dirty: boolean
  createBackup: boolean
  isLoading: boolean
  isValidating: boolean
  isFormatting: boolean
  isSaving: boolean
  validationTaskCount: number | null
  validationTasks: CatalogTaskSummary[]
  validationError?: string | null
  onValueChange: (nextValue: string) => void
  onCreateBackupChange: (nextValue: boolean) => void
  onValidate: () => void
  onFormat: () => void
  onSave: () => void
  onResetDraft: () => void
  onReload: () => void
}

export function CatalogManagerPanel({
  catalogPath,
  catalogExists,
  modifiedAt,
  validationState,
  validatedAt,
  value,
  dirty,
  createBackup,
  isLoading,
  isValidating,
  isFormatting,
  isSaving,
  validationTaskCount,
  validationTasks,
  validationError,
  onValueChange,
  onCreateBackupChange,
  onValidate,
  onFormat,
  onSave,
  onResetDraft,
  onReload,
}: CatalogManagerPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const filePickerRef = useRef<HTMLInputElement | null>(null)
  const [findText, setFindText] = useState('')
  const [findOffset, setFindOffset] = useState(0)
  const [findStatus, setFindStatus] = useState<string | null>(null)
  const [fileStatus, setFileStatus] = useState<string | null>(null)
  const [wordWrap, setWordWrap] = useState(false)
  const [starterPreset, setStarterPreset] = useState<StarterPreset>('dual')
  const [builder, setBuilder] = useState<BuilderDraft>(() => defaultBuilderDraft('classification'))
  const {
    studioTasks,
    studioStatus,
    setStudioTasks,
    setStudioStatus,
    updateStudioTask,
    updateStudioBaseTask,
    addStudioTask,
    duplicateStudioTask,
    moveStudioTask,
    sortStudioTasksByTaskType,
    removeStudioTask,
    resetStudioTasks,
  } = useCatalogStudioDrafts()
  const [previewTab, setPreviewTab] = useState<PreviewTab>('workspace')

  const lineCount = value.trim().length > 0 ? value.trim().split(/\r?\n/).length : 0
  const charCount = value.length
  const enabledStudioTaskCount = useMemo(() => studioTasks.filter((draft) => draft.enabled).length, [studioTasks])
  const taskCountLabel =
    validationTaskCount === null ? 'Validate to refresh task preview' : `${validationTaskCount} task(s) detected`
  const formattedTaskSnippet = useMemo(() => buildTaskSnippet(builder), [builder])
  const studioTaskSnippet = useMemo(() => buildTaskBlockSnippet(studioTasks), [studioTasks])
  const studioCatalogSnippet = useMemo(() => buildCatalogSnippet(studioTasks), [studioTasks])
  const duplicatedStudioTaskTypes = useMemo(
    () => findDuplicateTaskTypes(studioTasks.map((draft) => draft.taskType)),
    [studioTasks],
  )
  const studioIssues = useMemo(() => collectStudioIssues(studioTasks), [studioTasks])
  const studioIsValid = studioIssues.length === 0
  const taskOutline = useMemo(() => parseTaskOutline(value), [value])
  const duplicatedOutlineTaskTypes = useMemo(
    () => findDuplicateTaskTypes(taskOutline.map((item) => item.taskType)),
    [taskOutline],
  )
  const validatedTaskMap = useMemo(() => new Map(validationTasks.map((task) => [task.taskType, task])), [validationTasks])
  const validationErrorLine = useMemo(() => parseLineNumberFromError(validationError), [validationError])
  const validationBadge = useMemo(() => {
    if (isValidating) {
      return {
        label: 'Validating…',
        className: 'info' as const,
        detail: validatedAt ? `Last Validation: ${formatDate(validatedAt)}` : '검증 중입니다.',
      }
    }
    if (validationState === 'invalid') {
      return {
        label: 'Validation Error',
        className: 'warn' as const,
        detail: 'YAML 수정 후 Validate YAML을 다시 실행해 주세요.',
      }
    }
    if (validationState === 'valid') {
      if (dirty) {
        return {
          label: 'Re-validate Needed',
          className: 'warn' as const,
          detail: validatedAt ? `Last Validation: ${formatDate(validatedAt)}` : '저장 전 재검증이 필요합니다.',
        }
      }
      return {
        label: 'Schema Valid',
        className: 'ok' as const,
        detail: validatedAt ? `Last Validation: ${formatDate(validatedAt)}` : '검증 완료',
      }
    }
    return {
      label: 'Not Validated',
      className: 'info' as const,
      detail: 'Validate YAML 버튼으로 구조를 먼저 확인하세요.',
    }
  }, [dirty, isValidating, validatedAt, validationState])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!isSaving && !isLoading) {
          onSave()
        }
        return
      }

      if (event.key.toLowerCase() === 'enter') {
        event.preventDefault()
        if (!isValidating && !isLoading) {
          onValidate()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, isSaving, isValidating, onSave, onValidate])

  const updateBuilderBaseTask = (nextBaseTaskType: BaseTaskType) => {
    setBuilder((prev) => switchBuilderBaseTask(prev, nextBaseTaskType))
  }

  const replaceEditorWithStudioYaml = () => {
    if (value.trim().length > 0) {
      const confirmed = window.confirm(
        '현재 YAML 전체를 Studio 생성 결과로 교체합니다. 저장되지 않은 변경사항이 있다면 사라집니다. 계속할까요?',
      )
      if (!confirmed) return
    }
    onValueChange(studioCatalogSnippet)
    setFindOffset(0)
    setFindStatus(null)
    setStudioStatus(`Generated ${studioTasks.length} task(s) and replaced editor content.`)
  }

  const appendStudioTasks = () => {
    if (!studioIsValid) {
      setStudioStatus('Fix studio validation issues before appending tasks.')
      return
    }
    onValueChange(appendBlock(value, studioTaskSnippet))
    setStudioStatus(`Appended ${studioTasks.length} task block(s) to the editor.`)
  }

  const importStudioTasksFromEditor = () => {
    const parsed = parseStudioTasksFromYaml(value)
    if (parsed.length === 0) {
      setStudioStatus('Editor YAML에서 `- taskType:` 블록을 찾지 못했습니다.')
      return
    }
    setStudioTasks(parsed)
    setStudioStatus(`Loaded ${parsed.length} task(s) from editor YAML.`)
  }

  const replaceWithTemplate = () => {
    if (value.trim().length > 0) {
      const confirmed = window.confirm(
        '현재 편집 내용을 전체 템플릿으로 교체합니다. 저장되지 않은 변경사항이 있다면 사라집니다. 계속할까요?',
      )
      if (!confirmed) return
    }
    onValueChange(getStarterTemplate('dual'))
    setStudioTasks(studioDraftsForPreset('dual'))
    setStudioStatus('Loaded full template in editor and studio defaults.')
  }

  const applyStarterPreset = () => {
    if (value.trim().length > 0) {
      const confirmed = window.confirm(
        '현재 YAML 내용을 스타터 프리셋으로 교체합니다. 저장되지 않은 변경사항이 있다면 사라집니다. 계속할까요?',
      )
      if (!confirmed) return
    }
    const nextTemplate = getStarterTemplate(starterPreset)
    onValueChange(nextTemplate)
    setStudioTasks(studioDraftsForPreset(starterPreset))
    setFindOffset(0)
    setFindStatus(null)
    setStudioStatus(`Studio synced to "${starterPreset}" preset.`)
    setFileStatus(`Loaded "${starterPreset}" starter preset.`)
  }

  const downloadStudioYaml = () => {
    if (!studioIsValid) {
      setStudioStatus('Fix studio validation issues before exporting YAML.')
      return
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `training_catalog-studio-${timestamp}.yaml`
    const blob = new Blob([studioCatalogSnippet], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setStudioStatus(`Exported ${filename}`)
  }

  const insertAtCursor = (text: string) => {
    const editor = textareaRef.current
    const snippet = text.trimEnd() + '\n'
    if (!editor) {
      onValueChange(value + snippet)
      return
    }

    const selectionStart = editor.selectionStart ?? value.length
    const selectionEnd = editor.selectionEnd ?? selectionStart

    const prefix = value.slice(0, selectionStart)
    const suffix = value.slice(selectionEnd)
    const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith('\n')
    const needsTrailingBreak = suffix.length > 0 && !suffix.startsWith('\n')
    const patch = `${needsLeadingBreak ? '\n' : ''}${snippet}${needsTrailingBreak ? '\n' : ''}`
    const nextValue = `${prefix}${patch}${suffix}`

    onValueChange(nextValue)

    requestAnimationFrame(() => {
      const nextPos = prefix.length + patch.length
      editor.focus()
      editor.setSelectionRange(nextPos, nextPos)
    })
  }

  const findNext = () => {
    const needle = findText.trim().toLowerCase()
    if (!needle) {
      setFindStatus('검색어를 입력해 주세요.')
      return
    }

    const haystack = value.toLowerCase()
    if (!haystack.length) {
      setFindStatus('빈 문서입니다.')
      return
    }

    let index = haystack.indexOf(needle, findOffset)
    let wrapped = false
    if (index < 0) {
      index = haystack.indexOf(needle)
      wrapped = true
    }

    if (index < 0) {
      setFindStatus('일치하는 텍스트가 없습니다.')
      return
    }

    setFindOffset(index + needle.length)
    setFindStatus(wrapped ? '처음으로 돌아가서 찾았습니다.' : '다음 위치를 찾았습니다.')

    const editor = textareaRef.current
    if (!editor) return
    editor.focus()
    editor.setSelectionRange(index, index + needle.length)
  }

  const jumpToOffset = (nextOffset: number) => {
    const editor = textareaRef.current
    if (!editor) return

    const targetOffset = Math.max(0, Math.min(nextOffset, value.length))
    const linesBefore = value.slice(0, targetOffset).split(/\r?\n/).length - 1
    const approxLineHeight = 20

    editor.focus()
    editor.setSelectionRange(targetOffset, targetOffset)
    editor.scrollTop = Math.max(0, linesBefore * approxLineHeight - editor.clientHeight * 0.35)
  }

  const openImportPicker = () => {
    filePickerRef.current?.click()
  }

  const handleImportYaml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imported = await file.text()
      if (!imported.trim()) {
        setFileStatus(`Import skipped: ${file.name} is empty.`)
        return
      }

      if (dirty) {
        const shouldReplace = window.confirm(
          '현재 draft를 업로드한 YAML로 교체합니다. 저장되지 않은 변경사항이 사라질 수 있습니다. 계속할까요?',
        )
        if (!shouldReplace) {
          setFileStatus('Import canceled. Current draft preserved.')
          return
        }
      }

      onValueChange(imported)
      setFindOffset(0)
      setFindStatus(null)
      setFileStatus(`Imported ${file.name} (${imported.length.toLocaleString()} chars).`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown read error'
      setFileStatus(`Import failed: ${detail}`)
    }
  }

  const exportYaml = () => {
    if (!value.trim()) {
      setFileStatus('Export skipped: editor is empty.')
      return
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `training_catalog-${timestamp}.yaml`
    const blob = new Blob([value], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setFileStatus(`Exported ${filename}`)
  }

  const copyYamlToClipboard = async () => {
    if (!value.trim()) {
      setFileStatus('Copy skipped: editor is empty.')
      return
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }
      await navigator.clipboard.writeText(value)
      setFileStatus(`Copied ${charCount.toLocaleString()} chars to clipboard.`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown copy error'
      setFileStatus(`Copy failed (${detail}). Use Export YAML instead.`)
    }
  }

  const updateBuilderDraft = (patch: Partial<BuilderDraft>) => {
    setBuilder((prev) => ({ ...prev, ...patch }))
  }

  const studioReadyLabel = studioIsValid
    ? `Studio ready (${studioTasks.length} task(s)).`
    : `Studio has ${studioIssues.length} issue(s).`
  const hasYamlContent = value.trim().length > 0
  const composeReady = hasYamlContent
  const validateReady = validationState === 'valid'
  const saveReady = validateReady && !dirty

  const quickFlowMessage = !composeReady
    ? 'Step 1: starter preset을 불러오거나 YAML을 입력하세요.'
    : !validateReady
      ? 'Step 2: Validate YAML로 구조를 검증하세요.'
      : !saveReady
        ? 'Step 3: Save & Apply로 런처 스키마에 반영하세요.'
        : 'YAML과 런처 스키마가 동기화되었습니다.'

  const editorPanelActions: EditorPanelActions = {
    onCreateBackupChange,
    onWordWrapChange: setWordWrap,
    onStarterPresetChange: setStarterPreset,
    onApplyStarterPreset: applyStarterPreset,
    onReplaceWithTemplate: replaceWithTemplate,
    onJumpToTop: () => jumpToOffset(0),
    onJumpToEnd: () => jumpToOffset(value.length),
    onInsertClassificationTask: () => insertAtCursor(buildTaskSnippet(defaultBuilderDraft('classification'))),
    onInsertSegmentationTask: () => insertAtCursor(buildTaskSnippet(defaultBuilderDraft('segmentation'))),
    onOpenImportPicker: openImportPicker,
    onImportYaml: (event) => {
      void handleImportYaml(event)
    },
    onExportYaml: exportYaml,
    onCopyYamlToClipboard: () => {
      void copyYamlToClipboard()
    },
    onFindTextChange: (text) => {
      setFindText(text)
      setFindOffset(0)
      setFindStatus(null)
    },
    onFindNext: findNext,
    onValueChange,
    onJumpToValidationLine: () => {
      if (!validationErrorLine) return
      jumpToOffset(offsetForLine(value, validationErrorLine))
    },
  }

  const previewState: SharedPreviewState = {
    value,
    dirty,
    taskOutline,
    duplicatedOutlineTaskTypes,
    validationTasks,
    validatedTaskMap,
    validationTaskCount,
    validationBadge,
    enabledStudioTaskCount,
    studioTasks,
    studioStatus,
    duplicatedStudioTaskTypes,
    studioIssues,
    studioIsValid,
    studioReadyLabel,
    formattedTaskSnippet,
    studioCatalogSnippet,
    taskCountLabel,
  }

  const previewActions: SharedPreviewActions = {
    onJumpToOffset: jumpToOffset,
    onImportStudioTasksFromEditor: importStudioTasksFromEditor,
    onValidate,
    onFormat,
    onSave,
    onReplaceEditorWithStudioYaml: replaceEditorWithStudioYaml,
    onAppendStudioTasks: appendStudioTasks,
    onDownloadStudioYaml: downloadStudioYaml,
    onInsertFormattedTaskSnippetAtCursor: () => insertAtCursor(formattedTaskSnippet),
    onAppendFormattedTaskSnippet: () => onValueChange(appendBlock(value, formattedTaskSnippet)),
    onUpdateBuilderBaseTask: updateBuilderBaseTask,
    onBuilderChange: updateBuilderDraft,
  }

  const previewRuntime: SharedPreviewRuntime = {
    isLoading,
    isSaving,
    isValidating,
    isFormatting,
  }

  const studioDraftActions: StudioDraftActions = {
    updateStudioTask,
    updateStudioBaseTask,
    addStudioTask,
    duplicateStudioTask,
    moveStudioTask,
    sortStudioTasksByTaskType,
    removeStudioTask,
    resetStudioTasks,
  }

  return (
    <SectionCard
      title="Catalog Manager"
      subtitle="training_catalog.yaml을 웹에서 검증/저장하고 즉시 런처 스키마로 반영합니다."
      action={
        <div className="catalog-actions">
          <button type="button" onClick={onValidate} disabled={isValidating || isLoading}>
            {isValidating ? 'Validating…' : 'Validate YAML'}
          </button>
          <button type="button" onClick={onFormat} disabled={isFormatting || isLoading}>
            {isFormatting ? 'Formatting…' : 'Format YAML'}
          </button>
          <button type="button" className="primary" onClick={onSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving…' : 'Save & Apply'}
          </button>
          <button type="button" onClick={onResetDraft} disabled={!dirty || isLoading || isSaving}>
            Reset Draft
          </button>
          <button type="button" onClick={onReload} disabled={isLoading || isSaving}>
            Reload
          </button>
        </div>
      }
    >
      <CatalogQuickFlow
        composeReady={composeReady}
        validateReady={validateReady}
        saveReady={saveReady}
        dirty={dirty}
        message={quickFlowMessage}
      />

      <div className="catalog-grid">
        <CatalogEditorPane
          catalogPath={catalogPath}
          catalogExists={catalogExists}
          modifiedAt={modifiedAt}
          dirty={dirty}
          createBackup={createBackup}
          wordWrap={wordWrap}
          starterPreset={starterPreset}
          lineCount={lineCount}
          charCount={charCount}
          value={value}
          findText={findText}
          findStatus={findStatus}
          fileStatus={fileStatus}
          validationBadge={validationBadge}
          validationError={validationError}
          validationErrorLine={validationErrorLine}
          isLoading={isLoading}
          isSaving={isSaving}
          textareaRef={textareaRef}
          filePickerRef={filePickerRef}
          actions={editorPanelActions}
        />

        <CatalogPreviewPane
          previewTab={previewTab}
          onPreviewTabChange={setPreviewTab}
          state={previewState}
          actions={previewActions}
          studioActions={studioDraftActions}
          runtime={previewRuntime}
          builder={builder}
        />
      </div>
    </SectionCard>
  )
}
