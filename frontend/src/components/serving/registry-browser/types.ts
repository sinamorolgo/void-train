import type { RegistryArtifact, RegistryCatalogModel, RegistryStage } from '../../../types'

export interface ModelSelection {
  stage: RegistryStage
  version: string
  artifact: RegistryArtifact
  destinationDir: string
}

export interface RegistryDownloadPayload {
  modelName: string
  stage: RegistryStage
  version: string
  artifact: RegistryArtifact
  destinationDir: string
}

export function defaultSelection(model: RegistryCatalogModel): ModelSelection {
  return {
    stage: model.defaultStage,
    version: model.defaultVersion || 'latest',
    artifact: 'bundle',
    destinationDir: model.defaultDestinationDir || './backend/artifacts/downloads',
  }
}

export function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function hasDestination(value: string): boolean {
  return Boolean(value.trim())
}
