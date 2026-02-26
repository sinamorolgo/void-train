import type { BaseTaskType, CatalogStudioRegistryModel, CatalogStudioTask } from '../../types'

export function defaultTask(baseTaskType: BaseTaskType): CatalogStudioTask {
  if (baseTaskType === 'segmentation') {
    return {
      taskType: 'segmentation',
      enabled: true,
      title: 'Segmentation',
      description: 'Semantic segmentation trainer',
      baseTaskType: 'segmentation',
      runnerStartMethod: 'python_script',
      runnerTarget: 'backend/trainers/train_segmentation.py',
      runnerTargetEnvVar: 'SEGMENTATION_SCRIPT_PATH',
      runnerCwd: null,
      mlflowMetric: 'val_iou',
      mlflowMode: 'max',
      mlflowModelName: 'segmentation-best-model',
      mlflowArtifactPath: 'model',
      fieldOrder: ['run_name', 'dataset_root', 'epochs', 'mlflow_tracking_uri', 'mlflow_experiment'],
      hiddenFields: [],
      fieldOverrides: {
        run_name: { default: 'seg-quick-run' },
      },
      extraFields: [],
    }
  }

  return {
    taskType: 'classification',
    enabled: true,
    title: 'Classification',
    description: 'Image classification trainer',
    baseTaskType: 'classification',
    runnerStartMethod: 'python_script',
    runnerTarget: 'backend/trainers/train_classification.py',
    runnerTargetEnvVar: 'CLASSIFICATION_SCRIPT_PATH',
    runnerCwd: null,
    mlflowMetric: 'val_accuracy',
    mlflowMode: 'max',
    mlflowModelName: 'classification-best-model',
    mlflowArtifactPath: 'model',
    fieldOrder: ['run_name', 'dataset_root', 'epochs', 'mlflow_tracking_uri', 'mlflow_experiment'],
    hiddenFields: [],
    fieldOverrides: {
      run_name: { default: 'clf-quick-run' },
    },
    extraFields: [],
  }
}

export function defaultRegistryModel(taskType: BaseTaskType): CatalogStudioRegistryModel {
  if (taskType === 'segmentation') {
    return {
      id: 'segmentation',
      title: 'Segmentation Model',
      description: 'Primary segmentation model line.',
      taskType: 'segmentation',
      modelName: 'segmentation-best-model',
      defaultStage: 'release',
      defaultVersion: 'latest',
      defaultDestinationDir: './backend/artifacts/downloads',
    }
  }
  return {
    id: 'classification',
    title: 'Classification Model',
    description: 'Primary classification model line.',
    taskType: 'classification',
    modelName: 'classification-best-model',
    defaultStage: 'release',
    defaultVersion: 'latest',
    defaultDestinationDir: './backend/artifacts/downloads',
  }
}

export function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function parseFieldOverridesValue(raw: string): Record<string, Record<string, unknown>> {
  const parsed = JSON.parse(raw || '{}') as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('fieldOverrides must be a JSON object')
  }
  return parsed as Record<string, Record<string, unknown>>
}

export function parseExtraFieldsValue(raw: string): CatalogStudioTask['extraFields'] {
  const parsed = JSON.parse(raw || '[]') as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('extraFields must be a JSON array')
  }
  return parsed as CatalogStudioTask['extraFields']
}

export function collectValidationIssues(
  tasks: CatalogStudioTask[],
  registryModels: CatalogStudioRegistryModel[],
): string[] {
  const issues: string[] = []
  const taskTypeSet = new Set<string>()
  const registryIdSet = new Set<string>()

  tasks.forEach((task, index) => {
    const label = `Task #${index + 1}`
    if (!task.taskType.trim()) issues.push(`${label}: taskType is required`)
    if (!task.title.trim()) issues.push(`${label}: title is required`)
    if (!task.runnerTarget.trim()) issues.push(`${label}: runnerTarget is required`)
    if (!task.mlflowModelName.trim()) issues.push(`${label}: mlflowModelName is required`)

    const key = task.taskType.trim().toLowerCase()
    if (key) {
      if (taskTypeSet.has(key)) issues.push(`${label}: duplicated taskType '${task.taskType}'`)
      taskTypeSet.add(key)
    }

    const extraFieldNameSet = new Set<string>()
    task.extraFields.forEach((field, fieldIndex) => {
      const fieldLabel = `${label} extraField #${fieldIndex + 1}`
      const fieldName = field.name?.trim()
      if (!fieldName) {
        issues.push(`${fieldLabel}: name is required`)
      } else {
        const keyName = fieldName.toLowerCase()
        if (extraFieldNameSet.has(keyName)) issues.push(`${fieldLabel}: duplicated name '${fieldName}'`)
        extraFieldNameSet.add(keyName)
      }
      if (!field.valueType) issues.push(`${fieldLabel}: valueType is required`)
    })
  })

  registryModels.forEach((model, index) => {
    const label = `Registry #${index + 1}`
    if (!model.id.trim()) issues.push(`${label}: id is required`)
    if (!model.modelName.trim()) issues.push(`${label}: modelName is required`)
    if (!model.title.trim()) issues.push(`${label}: title is required`)

    const key = model.id.trim().toLowerCase()
    if (key) {
      if (registryIdSet.has(key)) issues.push(`${label}: duplicated id '${model.id}'`)
      registryIdSet.add(key)
    }
  })

  return issues
}
