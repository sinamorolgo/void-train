import { useEffect, useMemo, useRef, useState } from 'react'

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
import { SectionCard } from './SectionCard'

interface CatalogManagerPanelProps {
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

type PreviewTab = 'workspace' | 'navigator' | 'matrix' | 'studio' | 'builder' | 'validated'

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
  const validatedTaskMap = useMemo(
    () => new Map(validationTasks.map((task) => [task.taskType, task])),
    [validationTasks],
  )
  const validationErrorLine = useMemo(
    () => parseLineNumberFromError(validationError),
    [validationError],
  )
  const validationBadge = useMemo(() => {
    if (isValidating) {
      return {
        label: 'Validating…',
        className: 'info',
        detail: validatedAt ? `Last Validation: ${formatDate(validatedAt)}` : '검증 중입니다.',
      }
    }
    if (validationState === 'invalid') {
      return {
        label: 'Validation Error',
        className: 'warn',
        detail: 'YAML 수정 후 Validate YAML을 다시 실행해 주세요.',
      }
    }
    if (validationState === 'valid') {
      if (dirty) {
        return {
          label: 'Re-validate Needed',
          className: 'warn',
          detail: validatedAt ? `Last Validation: ${formatDate(validatedAt)}` : '저장 전 재검증이 필요합니다.',
        }
      }
      return {
        label: 'Schema Valid',
        className: 'ok',
        detail: validatedAt ? `Last Validation: ${formatDate(validatedAt)}` : '검증 완료',
      }
    }
    return {
      label: 'Not Validated',
      className: 'info',
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

  const handleImportYaml = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      <section className="catalog-quickflow" aria-label="Catalog quick flow">
        <ol className="catalog-quickflow-steps">
          <li className={`catalog-quickflow-step ${composeReady ? 'done' : 'current'}`}>
            <span>1</span>
            <div>
              <strong>Compose</strong>
              <small>YAML 작성 또는 Preset 적용</small>
            </div>
          </li>
          <li
            className={`catalog-quickflow-step ${
              validateReady ? 'done' : composeReady ? 'current' : 'pending'
            }`}
          >
            <span>2</span>
            <div>
              <strong>Validate</strong>
              <small>Catalog schema 검증</small>
            </div>
          </li>
          <li
            className={`catalog-quickflow-step ${
              saveReady ? 'done' : validateReady && dirty ? 'current' : 'pending'
            }`}
          >
            <span>3</span>
            <div>
              <strong>Save</strong>
              <small>런타임 설정 반영</small>
            </div>
          </li>
        </ol>
        <p className="muted">{quickFlowMessage}</p>
      </section>
      <div className="catalog-grid">
        <div className="catalog-editor-panel">
          <div className="catalog-meta">
            <span className={dirty ? 'badge warn' : 'badge ok'}>{dirty ? 'Unsaved Changes' : 'In Sync'}</span>
            <span className={`badge ${validationBadge.className}`}>{validationBadge.label}</span>
            <span className="muted">Path: {catalogPath}</span>
            <span className="muted">File: {catalogExists ? 'exists' : 'default template loaded'}</span>
            <span className="muted">Modified: {formatDate(modifiedAt)}</span>
            <span className="muted">
              Size: {lineCount} lines · {charCount.toLocaleString()} chars
            </span>
            <span className="muted">{validationBadge.detail}</span>
          </div>

          <div className="catalog-toolbar">
            <input
              ref={filePickerRef}
              className="sr-only"
              type="file"
              accept=".yaml,.yml,text/yaml,text/x-yaml"
              onChange={(event) => {
                void handleImportYaml(event)
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="catalog-tool-row">
              <label className="catalog-toggle" htmlFor="catalog-backup">
                <input
                  id="catalog-backup"
                  name="catalog_backup"
                  type="checkbox"
                  checked={createBackup}
                  onChange={(event) => onCreateBackupChange(event.target.checked)}
                />
                Save 전에 백업 파일 생성
              </label>

              <label className="catalog-toggle" htmlFor="catalog-wrap">
                <input
                  id="catalog-wrap"
                  name="catalog_wrap"
                  type="checkbox"
                  checked={wordWrap}
                  onChange={(event) => setWordWrap(event.target.checked)}
                />
                Word Wrap
              </label>
            </div>

            <div className="catalog-tool-row catalog-starter-row">
              <label htmlFor="catalog-starter-preset">Starter Preset</label>
              <select
                id="catalog-starter-preset"
                name="catalog_starter_preset"
                value={starterPreset}
                onChange={(event) => setStarterPreset(event.target.value as StarterPreset)}
              >
                <option value="dual">Dual Task (classification + segmentation)</option>
                <option value="classification">Classification Only</option>
                <option value="segmentation">Segmentation Only</option>
              </select>
              <button type="button" onClick={applyStarterPreset}>
                Load Preset
              </button>
              <span className="muted">코드를 수정하지 않고 task 베이스 구조를 빠르게 교체합니다.</span>
            </div>

            <div className="catalog-tool-row">
              <button type="button" onClick={replaceWithTemplate}>
                Replace with Full Template
              </button>
              <button type="button" onClick={() => jumpToOffset(0)}>
                Go to Top
              </button>
              <button type="button" onClick={() => jumpToOffset(value.length)}>
                Go to End
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor(buildTaskSnippet(defaultBuilderDraft('classification')))}
              >
                Insert Classification Task
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor(buildTaskSnippet(defaultBuilderDraft('segmentation')))}
              >
                Insert Segmentation Task
              </button>
            </div>

            <div className="catalog-tool-row catalog-file-actions">
              <button type="button" onClick={openImportPicker}>
                Import YAML
              </button>
              <button type="button" onClick={exportYaml} disabled={!value.trim()}>
                Export YAML
              </button>
              <button type="button" onClick={() => void copyYamlToClipboard()} disabled={!value.trim()}>
                Copy YAML
              </button>
              <span className="muted">
                {fileStatus ?? '로컬 YAML 파일을 가져오거나 현재 내용을 내보내 안전하게 버전 관리하세요.'}
              </span>
            </div>

            <div className="catalog-find">
              <label className="sr-only" htmlFor="catalog-find-input">
                Search in YAML
              </label>
              <input
                id="catalog-find-input"
                name="catalog_find"
                type="text"
                autoComplete="off"
                value={findText}
                placeholder="YAML에서 검색할 텍스트…"
                onChange={(event) => {
                  setFindText(event.target.value)
                  setFindOffset(0)
                  setFindStatus(null)
                }}
              />
              <button type="button" onClick={findNext} disabled={!findText.trim()}>
                Find Next
              </button>
              <span className="muted">{findStatus ?? 'Tip: Cmd/Ctrl+S 저장, Cmd/Ctrl+Enter 검증'}</span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className={`catalog-editor ${wordWrap ? 'wrap' : 'no-wrap'}`}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            spellCheck={false}
            aria-label="training catalog yaml editor"
          />

          {validationError ? (
            <div className="catalog-error" role="alert">
              <p>{validationError}</p>
              {validationErrorLine ? (
                <button type="button" onClick={() => jumpToOffset(offsetForLine(value, validationErrorLine))}>
                  Jump to line {validationErrorLine}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="catalog-preview" aria-live="polite">
          <h3>Task Preview</h3>
          <p>{taskCountLabel}</p>
          <nav className="catalog-preview-tabs" aria-label="YAML helper tabs">
            <button
              type="button"
              className={previewTab === 'workspace' ? 'active' : ''}
              onClick={() => setPreviewTab('workspace')}
              aria-pressed={previewTab === 'workspace'}
            >
              Workspace
            </button>
            <button
              type="button"
              className={previewTab === 'navigator' ? 'active' : ''}
              onClick={() => setPreviewTab('navigator')}
              aria-pressed={previewTab === 'navigator'}
            >
              Navigator
            </button>
            <button
              type="button"
              className={previewTab === 'matrix' ? 'active' : ''}
              onClick={() => setPreviewTab('matrix')}
              aria-pressed={previewTab === 'matrix'}
            >
              Task Matrix
            </button>
            <button
              type="button"
              className={previewTab === 'studio' ? 'active' : ''}
              onClick={() => setPreviewTab('studio')}
              aria-pressed={previewTab === 'studio'}
            >
              YAML Studio
            </button>
            <button
              type="button"
              className={previewTab === 'builder' ? 'active' : ''}
              onClick={() => setPreviewTab('builder')}
              aria-pressed={previewTab === 'builder'}
            >
              Block Builder
            </button>
            <button
              type="button"
              className={previewTab === 'validated' ? 'active' : ''}
              onClick={() => setPreviewTab('validated')}
              aria-pressed={previewTab === 'validated'}
            >
              Validated Tasks
            </button>
          </nav>

          {previewTab === 'workspace' ? (
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
                    {enabledStudioTaskCount}/{studioTasks.length}
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
                  <strong>{validationBadge.label}</strong>
                </article>
              </div>
              <div className="catalog-builder-actions">
                <button type="button" onClick={importStudioTasksFromEditor}>
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
                              <button type="button" className="outline-jump" onClick={() => jumpToOffset(item.offset)}>
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
          ) : null}

          {previewTab === 'navigator' ? (
            <>
              <section className="catalog-outline">
                <h4>Task Navigator</h4>
                <p>`- taskType:` 블록을 기준으로 YAML 위치를 빠르게 이동합니다.</p>
                {taskOutline.length === 0 ? (
                  <p className="empty">task 블록을 찾지 못했습니다.</p>
                ) : (
                  <ul className="catalog-outline-list">
                    {taskOutline.map((item) => (
                      <li key={`${item.taskType}-${item.line}`}>
                        <button type="button" className="outline-jump" onClick={() => jumpToOffset(item.offset)}>
                          <span>{item.taskType}</span>
                          <small>line {item.line}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="catalog-tips">
                <h4>Quick Rules</h4>
                <ul>
                  <li>`tasks`는 리스트여야 합니다.</li>
                  <li>`runner.target`은 실제 train 스크립트/모듈 경로를 가리켜야 합니다.</li>
                  <li>`fieldOverrides`에서 UI 라벨/기본값/설명을 제어할 수 있습니다.</li>
                  <li>`mlflow.metric` + `mode`로 best 모델 선택 기준을 바꿉니다.</li>
                </ul>
              </section>
            </>
          ) : null}

          {previewTab === 'matrix' ? (
            <section className="catalog-matrix">
              <h4>Task Matrix Editor</h4>
              <p>
                YAML을 직접 편집하지 않아도 task별 핵심 필드(enabled, title, description, runner, metric)를 표로
                빠르게 관리할 수 있습니다.
              </p>
              <div className="catalog-builder-actions">
                <button type="button" onClick={() => addStudioTask('classification')}>
                  + Classification Task
                </button>
                <button type="button" onClick={() => addStudioTask('segmentation')}>
                  + Segmentation Task
                </button>
                <button type="button" onClick={sortStudioTasksByTaskType}>
                  Sort by taskType
                </button>
                <button type="button" onClick={resetStudioTasks}>
                  Reset
                </button>
              </div>
              <div className="catalog-builder-actions">
                <button type="button" onClick={importStudioTasksFromEditor}>
                  Load from Editor YAML
                </button>
                <button type="button" onClick={replaceEditorWithStudioYaml} disabled={!studioIsValid}>
                  Replace Editor YAML
                </button>
                <button type="button" onClick={appendStudioTasks} disabled={!studioIsValid}>
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
                            onChange={(event) => updateStudioTask(index, { enabled: event.target.checked })}
                            aria-label={`Enable task ${index + 1}`}
                          />
                        </td>
                        <td>
                          <input
                            name={`matrix_task_type_${index}`}
                            value={draft.taskType}
                            onChange={(event) => updateStudioTask(index, { taskType: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            name={`matrix_title_${index}`}
                            value={draft.title}
                            onChange={(event) => updateStudioTask(index, { title: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            name={`matrix_description_${index}`}
                            value={draft.description}
                            onChange={(event) => updateStudioTask(index, { description: event.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            name={`matrix_base_task_type_${index}`}
                            value={draft.baseTaskType}
                            onChange={(event) => updateStudioBaseTask(index, event.target.value as BaseTaskType)}
                          >
                            <option value="classification">classification</option>
                            <option value="segmentation">segmentation</option>
                          </select>
                        </td>
                        <td>
                          <input
                            name={`matrix_runner_target_${index}`}
                            value={draft.runnerTarget}
                            onChange={(event) => updateStudioTask(index, { runnerTarget: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            name={`matrix_metric_${index}`}
                            value={draft.metric}
                            onChange={(event) => updateStudioTask(index, { metric: event.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            name={`matrix_mode_${index}`}
                            value={draft.mode}
                            onChange={(event) => updateStudioTask(index, { mode: event.target.value as 'max' | 'min' })}
                          >
                            <option value="max">max</option>
                            <option value="min">min</option>
                          </select>
                        </td>
                        <td>
                          <div className="catalog-matrix-actions">
                            <button type="button" onClick={() => moveStudioTask(index, -1)} disabled={index === 0}>
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStudioTask(index, 1)}
                              disabled={index === studioTasks.length - 1}
                            >
                              Down
                            </button>
                            <button type="button" onClick={() => duplicateStudioTask(index)}>
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStudioTask(index)}
                              disabled={studioTasks.length <= 1}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                {studioStatus ?? `Enabled ${enabledStudioTaskCount}/${studioTasks.length} tasks in matrix.`}
              </p>
            </section>
          ) : null}

          {previewTab === 'studio' ? (
            <section className="catalog-studio">
              <h4>YAML Studio</h4>
              <p>
                task 폼으로 `training_catalog.yaml` 전체를 생성합니다. raw YAML을 직접 편집하지 않아도 task
                리스트를 빠르게 교체할 수 있습니다.
              </p>
              <div className="catalog-builder-actions">
                <button type="button" onClick={() => addStudioTask('classification')}>
                  + Classification Task
                </button>
                <button type="button" onClick={() => addStudioTask('segmentation')}>
                  + Segmentation Task
                </button>
                <button type="button" onClick={sortStudioTasksByTaskType}>
                  Sort by taskType
                </button>
                <button type="button" onClick={resetStudioTasks}>
                  Reset Studio
                </button>
              </div>
              <div className="catalog-builder-actions">
                <button type="button" onClick={importStudioTasksFromEditor}>
                  Load from Editor YAML
                </button>
                <button type="button" onClick={replaceEditorWithStudioYaml} disabled={!studioIsValid}>
                  Replace Editor YAML
                </button>
                <button type="button" onClick={appendStudioTasks} disabled={!studioIsValid}>
                  Append Studio Tasks
                </button>
                <button type="button" onClick={downloadStudioYaml} disabled={!studioIsValid}>
                  Download Studio YAML
                </button>
              </div>
              {duplicatedStudioTaskTypes.length > 0 ? (
                <p className="catalog-inline-warning">
                  Duplicated taskType: {duplicatedStudioTaskTypes.join(', ')}. 저장 전에 taskType을 고유하게
                  맞춰주세요.
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
                        <button type="button" onClick={() => moveStudioTask(index, -1)} disabled={index === 0}>
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStudioTask(index, 1)}
                          disabled={index === studioTasks.length - 1}
                        >
                          Down
                        </button>
                        <button type="button" onClick={() => duplicateStudioTask(index)}>
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStudioTask(index)}
                          disabled={studioTasks.length <= 1}
                        >
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
                          onChange={(event) => updateStudioTask(index, { taskType: event.target.value })}
                        />
                      </label>
                      <label>
                        title
                        <input
                          name={`studio_title_${index}`}
                          autoComplete="off"
                          value={draft.title}
                          onChange={(event) => updateStudioTask(index, { title: event.target.value })}
                        />
                      </label>
                      <label>
                        description
                        <input
                          name={`studio_description_${index}`}
                          autoComplete="off"
                          value={draft.description}
                          onChange={(event) => updateStudioTask(index, { description: event.target.value })}
                        />
                      </label>
                      <label>
                        enabled
                        <select
                          name={`studio_enabled_${index}`}
                          value={draft.enabled ? 'true' : 'false'}
                          onChange={(event) => updateStudioTask(index, { enabled: event.target.value === 'true' })}
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
                          onChange={(event) => updateStudioBaseTask(index, event.target.value as BaseTaskType)}
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
                          onChange={(event) => updateStudioTask(index, { runnerTarget: event.target.value })}
                        />
                      </label>
                      <label>
                        mlflow.metric
                        <input
                          name={`studio_metric_${index}`}
                          autoComplete="off"
                          value={draft.metric}
                          onChange={(event) => updateStudioTask(index, { metric: event.target.value })}
                        />
                      </label>
                      <label>
                        mlflow.mode
                        <select
                          name={`studio_mode_${index}`}
                          value={draft.mode}
                          onChange={(event) =>
                            updateStudioTask(index, { mode: event.target.value as 'max' | 'min' })
                          }
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
          ) : null}

          {previewTab === 'builder' ? (
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
                    onChange={(event) => setBuilder((prev) => ({ ...prev, taskType: event.target.value }))}
                  />
                </label>
                <label>
                  title
                  <input
                    name="builder_title"
                    autoComplete="off"
                    value={builder.title}
                    onChange={(event) => setBuilder((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </label>
                <label>
                  description
                  <input
                    name="builder_description"
                    autoComplete="off"
                    value={builder.description}
                    onChange={(event) => setBuilder((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>
                <label>
                  enabled
                  <select
                    name="builder_enabled"
                    value={builder.enabled ? 'true' : 'false'}
                    onChange={(event) => setBuilder((prev) => ({ ...prev, enabled: event.target.value === 'true' }))}
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
                    onChange={(event) => updateBuilderBaseTask(event.target.value as BaseTaskType)}
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
                    onChange={(event) => setBuilder((prev) => ({ ...prev, runnerTarget: event.target.value }))}
                  />
                </label>
                <label>
                  mlflow.metric
                  <input
                    name="builder_metric"
                    autoComplete="off"
                    value={builder.metric}
                    onChange={(event) => setBuilder((prev) => ({ ...prev, metric: event.target.value }))}
                  />
                </label>
                <label>
                  mlflow.mode
                  <select
                    name="builder_mode"
                    value={builder.mode}
                    onChange={(event) => setBuilder((prev) => ({ ...prev, mode: event.target.value as 'max' | 'min' }))}
                  >
                    <option value="max">max</option>
                    <option value="min">min</option>
                  </select>
                </label>
              </div>
              <div className="catalog-builder-actions">
                <button type="button" onClick={() => insertAtCursor(formattedTaskSnippet)}>
                  Insert at Cursor
                </button>
                <button type="button" onClick={() => onValueChange(appendBlock(value, formattedTaskSnippet))}>
                  Append to End
                </button>
              </div>
              <details className="catalog-snippet-preview">
                <summary>Preview Generated Snippet</summary>
                <pre>{formattedTaskSnippet}</pre>
              </details>
            </section>
          ) : null}

          {previewTab === 'validated' ? (
            <div className="catalog-task-list">
              {validationTasks.length === 0 ? (
                <p className="empty">No validated tasks yet.</p>
              ) : (
                validationTasks.map((task) => (
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
                ))
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </SectionCard>
  )
}
