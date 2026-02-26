import { useMemo, useState } from 'react'

import type { RegistryArtifact, RegistryCatalogModel, RegistryStage } from '../../../types'
import { defaultSelection, hasDestination, type ModelSelection, type RegistryDownloadPayload } from './types'

export function useRegistryModelBrowser(models: RegistryCatalogModel[]) {
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectionByModel, setSelectionByModel] = useState<Record<string, ModelSelection>>({})

  const effectiveModelId = useMemo(() => {
    if (!models.length) return ''
    if (selectedModelId && models.some((item) => item.id === selectedModelId)) {
      return selectedModelId
    }
    return models[0].id
  }, [models, selectedModelId])

  const selectedModel = useMemo(
    () => models.find((item) => item.id === effectiveModelId) ?? null,
    [effectiveModelId, models],
  )

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

  const canDownload = Boolean(selectedModel && stageSnapshot?.exists && hasDestination(currentSelection.destinationDir))

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

  const updateStage = (nextStage: RegistryStage) => {
    if (!selectedModel) return
    const nextVersions = selectedModel.stages[nextStage].versions.map((item) => item.version)
    const currentVersion = currentSelection.version
    const nextVersion = currentVersion === 'latest' || nextVersions.includes(currentVersion) ? currentVersion : 'latest'
    updateSelection({ stage: nextStage, version: nextVersion })
  }

  const toDownloadPayload = (): RegistryDownloadPayload | null => {
    if (!selectedModel) return null
    return {
      modelName: selectedModel.modelName,
      stage: currentSelection.stage,
      version: effectiveVersion,
      artifact: currentSelection.artifact,
      destinationDir: currentSelection.destinationDir,
    }
  }

  return {
    effectiveModelId,
    selectedModel,
    currentSelection,
    stageSnapshot,
    availableVersions,
    effectiveVersion,
    canDownload,
    setSelectedModelId,
    updateSelection,
    updateStage,
    toDownloadPayload,
  }
}
