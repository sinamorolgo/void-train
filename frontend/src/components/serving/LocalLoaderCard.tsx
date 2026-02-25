import type { LocalModel, TaskType } from '../../types'

interface LocalLoaderCardProps {
  alias: string
  modelPath: string
  taskType: TaskType
  numClasses: number
  models: LocalModel[]
  busy: boolean
  onAliasChange: (value: string) => void
  onModelPathChange: (value: string) => void
  onTaskTypeChange: (value: TaskType) => void
  onNumClassesChange: (value: number) => void
  onLoad: () => void
}

export function LocalLoaderCard({
  alias,
  modelPath,
  taskType,
  numClasses,
  models,
  busy,
  onAliasChange,
  onModelPathChange,
  onTaskTypeChange,
  onNumClassesChange,
  onLoad,
}: LocalLoaderCardProps) {
  return (
    <div className="mini-card">
      <h3>Local Loader</h3>
      <div className="compact-fields">
        <label>
          Alias
          <input name="local_alias" autoComplete="off" value={alias} onChange={(event) => onAliasChange(event.target.value)} />
        </label>
        <label>
          Checkpoint Path
          <input
            name="local_model_path"
            autoComplete="off"
            value={modelPath}
            onChange={(event) => onModelPathChange(event.target.value)}
          />
        </label>
        <label>
          Task Type
          <select
            name="local_task_type"
            value={taskType}
            onChange={(event) => onTaskTypeChange(event.target.value as TaskType)}
          >
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
      </div>
      <button type="button" disabled={busy || !alias || !modelPath} onClick={onLoad}>
        Load Local Model
      </button>

      <ul className="inline-list">
        {models.map((model) => (
          <li key={model.alias}>
            <span>{model.alias}</span>
            <small>{model.path}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
