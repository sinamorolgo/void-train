import type { RegistryArtifact, RegistryCatalogModel, RegistryStage } from '../../../types'
import { formatDate } from './types'
import type { ModelSelection } from './types'

interface RegistrySelectionControlsProps {
  models: RegistryCatalogModel[]
  selectedModelId: string
  currentSelection: ModelSelection
  availableVersions: string[]
  effectiveVersion: string
  stageUpdatedAt: string | null
  onSelectModel: (modelId: string) => void
  onStageChange: (stage: RegistryStage) => void
  onVersionChange: (version: string) => void
  onArtifactChange: (artifact: RegistryArtifact) => void
  onDestinationChange: (value: string) => void
}

export function RegistrySelectionControls({
  models,
  selectedModelId,
  currentSelection,
  availableVersions,
  effectiveVersion,
  stageUpdatedAt,
  onSelectModel,
  onStageChange,
  onVersionChange,
  onArtifactChange,
  onDestinationChange,
}: RegistrySelectionControlsProps) {
  return (
    <div className="compact-fields">
      <label>
        Selected Model
        <select value={selectedModelId} onChange={(event) => onSelectModel(event.target.value)}>
          {models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>

      <label>
        Stage
        <select value={currentSelection.stage} onChange={(event) => onStageChange(event.target.value as RegistryStage)}>
          <option value="dev">dev</option>
          <option value="release">release</option>
        </select>
      </label>

      <label>
        Version
        <select value={effectiveVersion} onChange={(event) => onVersionChange(event.target.value)}>
          <option value="latest">latest</option>
          {availableVersions.map((itemVersion) => (
            <option key={itemVersion} value={itemVersion}>
              {itemVersion}
            </option>
          ))}
        </select>
      </label>

      <label>
        Artifact
        <select value={currentSelection.artifact} onChange={(event) => onArtifactChange(event.target.value as RegistryArtifact)}>
          <option value="bundle">bundle.tar.gz</option>
          <option value="manifest">manifest.json</option>
          <option value="standard_pytorch">model-standard.pt</option>
        </select>
      </label>

      <label>
        Destination
        <input value={currentSelection.destinationDir} onChange={(event) => onDestinationChange(event.target.value)} />
      </label>

      <label>
        Stage Updated
        <input value={formatDate(stageUpdatedAt)} readOnly />
      </label>
    </div>
  )
}
