import type { RegistryCatalogModel } from '../../types'
import { RegistryModelTable } from './registry-browser/RegistryModelTable'
import { RegistrySelectionControls } from './registry-browser/RegistrySelectionControls'
import { useRegistryModelBrowser } from './registry-browser/useRegistryModelBrowser'

interface RegistryModelBrowserCardProps {
  models: RegistryCatalogModel[]
  busy: boolean
  onDownload: (payload: {
    modelName: string
    stage: 'dev' | 'release'
    version: string
    artifact: 'bundle' | 'manifest' | 'standard_pytorch'
    destinationDir: string
  }) => void
}

export function RegistryModelBrowserCard({ models, busy, onDownload }: RegistryModelBrowserCardProps) {
  const {
    effectiveModelId,
    currentSelection,
    stageSnapshot,
    availableVersions,
    effectiveVersion,
    canDownload,
    setSelectedModelId,
    updateSelection,
    updateStage,
    toDownloadPayload,
  } = useRegistryModelBrowser(models)

  const handleDownload = () => {
    const payload = toDownloadPayload()
    if (!payload) return
    onDownload(payload)
  }

  return (
    <div className="mini-card registry-browser-card">
      <h3>Model Registry Browser</h3>
      <p className="muted">`training_catalog.yaml`의 `registryModels` 기준으로 세그/분류 모델을 조회하고 다운로드합니다.</p>

      {models.length ? (
        <>
          <RegistryModelTable models={models} selectedModelId={effectiveModelId} onSelectModel={setSelectedModelId} />

          <RegistrySelectionControls
            models={models}
            selectedModelId={effectiveModelId}
            currentSelection={currentSelection}
            availableVersions={availableVersions}
            effectiveVersion={effectiveVersion}
            stageUpdatedAt={stageSnapshot?.updatedAt ?? null}
            onSelectModel={setSelectedModelId}
            onStageChange={updateStage}
            onVersionChange={(version) => updateSelection({ version })}
            onArtifactChange={(artifact) => updateSelection({ artifact })}
            onDestinationChange={(destinationDir) => updateSelection({ destinationDir })}
          />

          <button type="button" disabled={busy || !canDownload} onClick={handleDownload}>
            Download Selected Artifact
          </button>
        </>
      ) : (
        <p className="empty">YAML `registryModels`를 먼저 설정해 주세요.</p>
      )}
    </div>
  )
}
