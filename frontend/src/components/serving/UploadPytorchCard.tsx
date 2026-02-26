import type { BaseTaskType, RegistryStage } from '../../types'

interface UploadPytorchCardProps {
  modelName: string
  stage: RegistryStage
  version: string
  notes: string
  taskType: BaseTaskType
  numClasses: number
  convertToTorchStandard: boolean
  fileName: string
  busy: boolean
  onModelNameChange: (value: string) => void
  onStageChange: (value: RegistryStage) => void
  onVersionChange: (value: string) => void
  onNotesChange: (value: string) => void
  onTaskTypeChange: (value: BaseTaskType) => void
  onNumClassesChange: (value: number) => void
  onConvertChange: (value: boolean) => void
  onFileChange: (file: File | null) => void
  onUpload: () => void
}

export function UploadPytorchCard({
  modelName,
  stage,
  version,
  notes,
  taskType,
  numClasses,
  convertToTorchStandard,
  fileName,
  busy,
  onModelNameChange,
  onStageChange,
  onVersionChange,
  onNotesChange,
  onTaskTypeChange,
  onNumClassesChange,
  onConvertChange,
  onFileChange,
  onUpload,
}: UploadPytorchCardProps) {
  return (
    <div className="mini-card">
      <h3>Upload .pth/.pt and Register</h3>
      <div className="compact-fields">
        <label>
          Model Name
          <input value={modelName} onChange={(event) => onModelNameChange(event.target.value)} />
        </label>
        <label>
          Stage
          <select value={stage} onChange={(event) => onStageChange(event.target.value as RegistryStage)}>
            <option value="dev">dev</option>
            <option value="release">release</option>
          </select>
        </label>
        <label>
          Upload File (.pth/.pt)
          <input
            type="file"
            accept=".pth,.pt,.tar,.gz,.zip"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <small className="muted">{fileName || '선택된 파일 없음'}</small>
        </label>
        <label>
          Version (optional)
          <input value={version} onChange={(event) => onVersionChange(event.target.value)} placeholder="v0001" />
        </label>
        <label>
          Torch Task Type
          <select value={taskType} onChange={(event) => onTaskTypeChange(event.target.value as BaseTaskType)}>
            <option value="classification">classification</option>
            <option value="segmentation">segmentation</option>
          </select>
        </label>
        <label>
          Num Classes
          <input
            type="number"
            value={numClasses}
            onChange={(event) => onNumClassesChange(Number.parseInt(event.target.value, 10) || 2)}
          />
        </label>
        <label>
          Notes
          <input value={notes} onChange={(event) => onNotesChange(event.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={convertToTorchStandard} onChange={(event) => onConvertChange(event.target.checked)} />
          Convert to Torch Standard
        </label>
      </div>
      <button type="button" disabled={busy || !modelName || !fileName} onClick={onUpload}>
        Upload + Register
      </button>
    </div>
  )
}
