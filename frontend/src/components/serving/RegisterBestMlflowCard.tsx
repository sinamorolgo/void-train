import type { BaseTaskType, MlflowExperimentItem, RegistryStage } from '../../types'

interface RegisterBestMlflowCardProps {
  trackingUri: string
  experimentName: string
  taskType: BaseTaskType
  metric: string
  mode: 'max' | 'min'
  modelName: string
  artifactPath: string
  stage: RegistryStage
  version: string
  notes: string
  convertToTorchStandard: boolean
  torchTaskType: BaseTaskType
  torchNumClasses: number
  experiments: MlflowExperimentItem[]
  busy: boolean
  onTrackingUriChange: (value: string) => void
  onExperimentNameChange: (value: string) => void
  onTaskTypeChange: (value: BaseTaskType) => void
  onMetricChange: (value: string) => void
  onModeChange: (value: 'max' | 'min') => void
  onModelNameChange: (value: string) => void
  onArtifactPathChange: (value: string) => void
  onStageChange: (value: RegistryStage) => void
  onVersionChange: (value: string) => void
  onNotesChange: (value: string) => void
  onConvertChange: (value: boolean) => void
  onTorchTaskTypeChange: (value: BaseTaskType) => void
  onTorchNumClassesChange: (value: number) => void
  onPublish: () => void
}

export function RegisterBestMlflowCard({
  trackingUri,
  experimentName,
  taskType,
  metric,
  mode,
  modelName,
  artifactPath,
  stage,
  version,
  notes,
  convertToTorchStandard,
  torchTaskType,
  torchNumClasses,
  experiments,
  busy,
  onTrackingUriChange,
  onExperimentNameChange,
  onTaskTypeChange,
  onMetricChange,
  onModeChange,
  onModelNameChange,
  onArtifactPathChange,
  onStageChange,
  onVersionChange,
  onNotesChange,
  onConvertChange,
  onTorchTaskTypeChange,
  onTorchNumClassesChange,
  onPublish,
}: RegisterBestMlflowCardProps) {
  return (
    <div className="mini-card">
      <h3>Publish Best Run to FTP</h3>
      <div className="compact-fields">
        <label>
          Tracking URI
          <input value={trackingUri} onChange={(event) => onTrackingUriChange(event.target.value)} />
        </label>
        <label>
          Experiment Name
          <input
            value={experimentName}
            onChange={(event) => onExperimentNameChange(event.target.value)}
            list="mlflow-experiment-list"
            placeholder="void-train-manager"
          />
          <datalist id="mlflow-experiment-list">
            {experiments.map((item) => (
              <option key={item.experimentId} value={item.name} />
            ))}
          </datalist>
        </label>
        <label>
          Task Type
          <select value={taskType} onChange={(event) => onTaskTypeChange(event.target.value as BaseTaskType)}>
            <option value="classification">classification</option>
            <option value="segmentation">segmentation</option>
          </select>
        </label>
        <label>
          Stage
          <select value={stage} onChange={(event) => onStageChange(event.target.value as RegistryStage)}>
            <option value="dev">dev</option>
            <option value="release">release</option>
          </select>
        </label>
        <label>
          Metric
          <input value={metric} onChange={(event) => onMetricChange(event.target.value)} placeholder="val_accuracy" />
        </label>
        <label>
          Mode
          <select value={mode} onChange={(event) => onModeChange(event.target.value as 'max' | 'min')}>
            <option value="max">max</option>
            <option value="min">min</option>
          </select>
        </label>
        <label>
          Model Name
          <input value={modelName} onChange={(event) => onModelNameChange(event.target.value)} />
        </label>
        <label>
          Artifact Path
          <input value={artifactPath} onChange={(event) => onArtifactPathChange(event.target.value)} />
        </label>
        <label>
          Version (optional)
          <input value={version} onChange={(event) => onVersionChange(event.target.value)} placeholder="v0001" />
        </label>
        <label>
          Notes
          <input value={notes} onChange={(event) => onNotesChange(event.target.value)} />
        </label>
        <label>
          Torch Task Type
          <select value={torchTaskType} onChange={(event) => onTorchTaskTypeChange(event.target.value as BaseTaskType)}>
            <option value="classification">classification</option>
            <option value="segmentation">segmentation</option>
          </select>
        </label>
        <label>
          Num Classes
          <input
            type="number"
            value={torchNumClasses}
            onChange={(event) => onTorchNumClassesChange(Number.parseInt(event.target.value, 10) || 2)}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={convertToTorchStandard} onChange={(event) => onConvertChange(event.target.checked)} />
          Convert to Torch Standard
        </label>
      </div>
      <button type="button" disabled={busy || !experimentName || !modelName || !metric} onClick={onPublish}>
        Pick Best + Publish
      </button>
    </div>
  )
}
