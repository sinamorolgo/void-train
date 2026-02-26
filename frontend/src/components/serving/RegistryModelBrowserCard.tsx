import { useMemo, useState } from 'react'

import type { RegistryArtifact, RegistryCatalogModel, RegistryStage } from '../../types'

interface RegistryModelBrowserCardProps {
  models: RegistryCatalogModel[]
  busy: boolean
  onDownload: (payload: {
    modelName: string
    stage: RegistryStage
    version: string
    artifact: RegistryArtifact
    destinationDir: string
  }) => void
}

interface ModelSelection {
  stage: RegistryStage
  version: string
  artifact: RegistryArtifact
  destinationDir: string
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function defaultSelection(model: RegistryCatalogModel): ModelSelection {
  return {
    stage: model.defaultStage,
    version: model.defaultVersion || 'latest',
    artifact: 'bundle',
    destinationDir: model.defaultDestinationDir || './backend/artifacts/downloads',
  }
}

export function RegistryModelBrowserCard({ models, busy, onDownload }: RegistryModelBrowserCardProps) {
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectionByModel, setSelectionByModel] = useState<Record<string, ModelSelection>>({})

  const effectiveModelId = useMemo(() => {
    if (!models.length) return ''
    if (selectedModelId && models.some((item) => item.id === selectedModelId)) {
      return selectedModelId
    }
    return models[0].id
  }, [models, selectedModelId])

  const selectedModel = useMemo(() => models.find((item) => item.id === effectiveModelId) ?? null, [models, effectiveModelId])

  const currentSelection = useMemo(() => {
    if (!selectedModel) {
      return {
        stage: 'release' as RegistryStage,
        version: 'latest',
        artifact: 'bundle' as RegistryArtifact,
        destinationDir: './backend/artifacts/downloads',
      }
    }
    return selectionByModel[selectedModel.id] ?? defaultSelection(selectedModel)
  }, [selectedModel, selectionByModel])

  const stageSnapshot = selectedModel?.stages[currentSelection.stage] ?? null
  const availableVersions = useMemo(
    () => stageSnapshot?.versions.map((item) => item.version).filter(Boolean) ?? [],
    [stageSnapshot],
  )
  const effectiveVersion =
    currentSelection.version === 'latest' || availableVersions.includes(currentSelection.version)
      ? currentSelection.version
      : 'latest'

  const canDownload = Boolean(selectedModel && stageSnapshot?.exists && destinationDirOrEmpty(currentSelection.destinationDir))

  const updateSelection = (patch: Partial<ModelSelection>) => {
    if (!selectedModel) return
    setSelectionByModel((prev) => {
      const current = prev[selectedModel.id] ?? defaultSelection(selectedModel)
      return {
        ...prev,
        [selectedModel.id]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  return (
    <div className="mini-card registry-browser-card">
      <h3>Model Registry Browser</h3>
      <p className="muted">`training_catalog.yaml`의 `registryModels` 기준으로 세그/분류 모델을 조회하고 다운로드합니다.</p>

      {models.length ? (
        <>
          <div className="registry-model-table-wrap">
            <table className="registry-model-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Type</th>
                  <th>Dev</th>
                  <th>Release</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {models.map((item) => (
                  <tr key={item.id} className={item.id === effectiveModelId ? 'selected' : ''}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.modelName}</small>
                    </td>
                    <td>
                      <span className={`task-pill ${item.taskType}`}>{item.taskType}</span>
                    </td>
                    <td>
                      {item.stages.dev.exists ? (
                        <small>
                          latest: {item.stages.dev.latest ?? '-'} ({item.stages.dev.versionCount})
                        </small>
                      ) : (
                        <small className="empty-cell">-</small>
                      )}
                    </td>
                    <td>
                      {item.stages.release.exists ? (
                        <small>
                          latest: {item.stages.release.latest ?? '-'} ({item.stages.release.versionCount})
                        </small>
                      ) : (
                        <small className="empty-cell">-</small>
                      )}
                    </td>
                    <td>
                      <button type="button" onClick={() => setSelectedModelId(item.id)}>
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="compact-fields">
            <label>
              Selected Model
              <select value={effectiveModelId} onChange={(event) => setSelectedModelId(event.target.value)}>
                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Stage
              <select
                value={currentSelection.stage}
                onChange={(event) => {
                  const nextStage = event.target.value as RegistryStage
                  const nextVersions = selectedModel?.stages[nextStage].versions.map((item) => item.version) ?? []
                  const currentVersion = currentSelection.version
                  const nextVersion =
                    currentVersion === 'latest' || nextVersions.includes(currentVersion) ? currentVersion : 'latest'
                  updateSelection({ stage: nextStage, version: nextVersion })
                }}
              >
                <option value="dev">dev</option>
                <option value="release">release</option>
              </select>
            </label>

            <label>
              Version
              <select value={effectiveVersion} onChange={(event) => updateSelection({ version: event.target.value })}>
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
              <select
                value={currentSelection.artifact}
                onChange={(event) => updateSelection({ artifact: event.target.value as RegistryArtifact })}
              >
                <option value="bundle">bundle.tar.gz</option>
                <option value="manifest">manifest.json</option>
                <option value="standard_pytorch">model-standard.pt</option>
              </select>
            </label>

            <label>
              Destination
              <input
                value={currentSelection.destinationDir}
                onChange={(event) => updateSelection({ destinationDir: event.target.value })}
              />
            </label>

            <label>
              Stage Updated
              <input value={formatDate(stageSnapshot?.updatedAt ?? null)} readOnly />
            </label>
          </div>

          <button
            type="button"
            disabled={busy || !canDownload}
            onClick={() =>
              selectedModel
                ? onDownload({
                    modelName: selectedModel.modelName,
                    stage: currentSelection.stage,
                    version: effectiveVersion,
                    artifact: currentSelection.artifact,
                    destinationDir: currentSelection.destinationDir,
                  })
                : null
            }
          >
            Download Selected Artifact
          </button>
        </>
      ) : (
        <p className="empty">YAML `registryModels`를 먼저 설정해 주세요.</p>
      )}
    </div>
  )
}

function destinationDirOrEmpty(value: string): boolean {
  return Boolean(value.trim())
}
