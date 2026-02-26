import type { RefObject } from 'react'

import type { StarterPreset } from '../catalogManagerUtils'
import { formatDate } from '../catalogManagerUtils'
import type { EditorPanelActions, ValidationBadge } from './types'

interface CatalogEditorPaneProps {
  catalogPath: string
  catalogExists: boolean
  modifiedAt: string | null
  dirty: boolean
  createBackup: boolean
  wordWrap: boolean
  starterPreset: StarterPreset
  lineCount: number
  charCount: number
  value: string
  findText: string
  findStatus: string | null
  fileStatus: string | null
  validationBadge: ValidationBadge
  validationError?: string | null
  validationErrorLine: number | null
  isLoading: boolean
  isSaving: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  filePickerRef: RefObject<HTMLInputElement | null>
  actions: EditorPanelActions
}

export function CatalogEditorPane({
  catalogPath,
  catalogExists,
  modifiedAt,
  dirty,
  createBackup,
  wordWrap,
  starterPreset,
  lineCount,
  charCount,
  value,
  findText,
  findStatus,
  fileStatus,
  validationBadge,
  validationError,
  validationErrorLine,
  isLoading,
  isSaving,
  textareaRef,
  filePickerRef,
  actions,
}: CatalogEditorPaneProps) {
  return (
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
          onChange={actions.onImportYaml}
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
              onChange={(event) => actions.onCreateBackupChange(event.target.checked)}
            />
            Save 전에 백업 파일 생성
          </label>

          <label className="catalog-toggle" htmlFor="catalog-wrap">
            <input
              id="catalog-wrap"
              name="catalog_wrap"
              type="checkbox"
              checked={wordWrap}
              onChange={(event) => actions.onWordWrapChange(event.target.checked)}
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
            onChange={(event) => actions.onStarterPresetChange(event.target.value as StarterPreset)}
          >
            <option value="dual">Dual Task (classification + segmentation)</option>
            <option value="classification">Classification Only</option>
            <option value="segmentation">Segmentation Only</option>
          </select>
          <button type="button" onClick={actions.onApplyStarterPreset}>
            Load Preset
          </button>
          <span className="muted">코드를 수정하지 않고 task 베이스 구조를 빠르게 교체합니다.</span>
        </div>

        <div className="catalog-tool-row">
          <button type="button" onClick={actions.onReplaceWithTemplate}>
            Replace with Full Template
          </button>
          <button type="button" onClick={actions.onJumpToTop}>
            Go to Top
          </button>
          <button type="button" onClick={actions.onJumpToEnd}>
            Go to End
          </button>
          <button type="button" onClick={actions.onInsertClassificationTask}>
            Insert Classification Task
          </button>
          <button type="button" onClick={actions.onInsertSegmentationTask}>
            Insert Segmentation Task
          </button>
        </div>

        <div className="catalog-tool-row catalog-file-actions">
          <button type="button" onClick={actions.onOpenImportPicker}>
            Import YAML
          </button>
          <button type="button" onClick={actions.onExportYaml} disabled={!value.trim()}>
            Export YAML
          </button>
          <button type="button" onClick={actions.onCopyYamlToClipboard} disabled={!value.trim()}>
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
            onChange={(event) => actions.onFindTextChange(event.target.value)}
          />
          <button type="button" onClick={actions.onFindNext} disabled={!findText.trim()}>
            Find Next
          </button>
          <span className="muted">{findStatus ?? 'Tip: Cmd/Ctrl+S 저장, Cmd/Ctrl+Enter 검증'}</span>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className={`catalog-editor ${wordWrap ? 'wrap' : 'no-wrap'}`}
        value={value}
        onChange={(event) => actions.onValueChange(event.target.value)}
        spellCheck={false}
        aria-label="training catalog yaml editor"
      />

      {validationError ? (
        <div className="catalog-error" role="alert">
          <p>{validationError}</p>
          {validationErrorLine ? (
            <button type="button" onClick={actions.onJumpToValidationLine}>
              Jump to line {validationErrorLine}
            </button>
          ) : null}
        </div>
      ) : null}

      {(isLoading || isSaving) && <p className="muted">Processing catalog changes…</p>}
    </div>
  )
}
