import type { BaseTaskType, RegistryStage } from '../../types'

interface RegisterPytorchCardProps {
  modelName: string
  stage: RegistryStage
  localPath: string
  version: string
  notes: string
  taskType: BaseTaskType
  numClasses: number
  convertToTorchStandard: boolean
  busy: boolean
  onModelNameChange: (value: string) => void
  onStageChange: (value: RegistryStage) => void
  onLocalPathChange: (value: string) => void
  onVersionChange: (value: string) => void
  onNotesChange: (value: string) => void
  onTaskTypeChange: (value: BaseTaskType) => void
  onNumClassesChange: (value: number) => void
  onConvertChange: (value: boolean) => void
  onRegister: () => void
}

export function RegisterPytorchCard({
  modelName,
  stage,
  localPath,
  version,
  notes,
  taskType,
  numClasses,
  convertToTorchStandard,
  busy,
  onModelNameChange,
  onStageChange,
  onLocalPathChange,
  onVersionChange,
  onNotesChange,
  onTaskTypeChange,
  onNumClassesChange,
  onConvertChange,
  onRegister,
}: RegisterPytorchCardProps) {
  return (
    <div className="mini-card">
      <h3>Register .pth/.pt to FTP</h3>
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
          Local Path (.pth/.pt)
          <input
            name="register_local_path"
            value={localPath}
            onChange={(event) => onLocalPathChange(event.target.value)}
            placeholder="./outputs/checkpoints/best_checkpoint.pth"
          />
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
          Convert to Torch Standard (`model-standard.pt`)
        </label>
      </div>
      <button type="button" disabled={busy || !modelName || !localPath} onClick={onRegister}>
        Publish + Register
      </button>
    </div>
  )
}
