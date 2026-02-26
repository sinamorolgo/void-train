import type { BaseTaskType } from '../../types'

export interface BuilderDraft {
  taskType: string
  title: string
  description: string
  enabled: boolean
  baseTaskType: BaseTaskType
  runnerTarget: string
  metric: string
  mode: 'max' | 'min'
}

export interface TaskOutlineItem {
  taskType: string
  line: number
  offset: number
}

export interface StudioIssue {
  key: string
  message: string
}

export type StarterPreset = 'dual' | 'classification' | 'segmentation'

const FULL_CATALOG_TEMPLATE = `tasks:
  - taskType: classification
    enabled: true
    title: Classification
    description: Image classification trainer
    baseTaskType: classification
    runner:
      startMethod: python_script
      target: backend/trainers/train_classification.py
      targetEnvVar: CLASSIFICATION_SCRIPT_PATH
    mlflow:
      metric: val_accuracy
      mode: max
      modelName: classification-best-model
      artifactPath: model
    fieldOrder:
      - run_name
      - dataset_root
      - output_root
      - checkpoint_dir
      - tensorboard_dir
      - epochs
      - batch_size
      - learning_rate
      - num_workers
      - seed
      - gpu_ids
      - use_amp
      - force_cpu
      - save_every
      - model_name
      - num_classes
      - image_size
      - steps_per_epoch
      - mlflow_tracking_uri
      - mlflow_experiment
    fieldOverrides:
      run_name:
        default: clf-quick-run
      model_name:
        default: tiny-cnn

  - taskType: segmentation
    enabled: true
    title: Segmentation
    description: Semantic segmentation trainer
    baseTaskType: segmentation
    runner:
      startMethod: python_script
      target: backend/trainers/train_segmentation.py
      targetEnvVar: SEGMENTATION_SCRIPT_PATH
    mlflow:
      metric: val_iou
      mode: max
      modelName: segmentation-best-model
      artifactPath: model
    fieldOrder:
      - run_name
      - dataset_root
      - output_root
      - checkpoint_dir
      - tensorboard_dir
      - epochs
      - batch_size
      - learning_rate
      - num_workers
      - seed
      - gpu_ids
      - use_amp
      - force_cpu
      - save_every
      - encoder_name
      - num_classes
      - input_height
      - input_width
      - dice_weight
      - ce_weight
      - steps_per_epoch
      - mlflow_tracking_uri
      - mlflow_experiment
    fieldOverrides:
      run_name:
        default: seg-quick-run
      encoder_name:
        default: tiny-unet-like
`

const CLASSIFICATION_CATALOG_TEMPLATE = `tasks:
  - taskType: classification
    enabled: true
    title: Classification
    description: Image classification trainer
    baseTaskType: classification
    runner:
      startMethod: python_script
      target: backend/trainers/train_classification.py
      targetEnvVar: CLASSIFICATION_SCRIPT_PATH
    mlflow:
      metric: val_accuracy
      mode: max
      modelName: classification-best-model
      artifactPath: model
    fieldOrder:
      - run_name
      - dataset_root
      - output_root
      - checkpoint_dir
      - tensorboard_dir
      - epochs
      - batch_size
      - learning_rate
      - num_workers
      - seed
      - gpu_ids
      - use_amp
      - force_cpu
      - save_every
      - model_name
      - num_classes
      - image_size
      - steps_per_epoch
      - mlflow_tracking_uri
      - mlflow_experiment
    fieldOverrides:
      run_name:
        default: clf-quick-run
      model_name:
        default: tiny-cnn
`

const SEGMENTATION_CATALOG_TEMPLATE = `tasks:
  - taskType: segmentation
    enabled: true
    title: Segmentation
    description: Semantic segmentation trainer
    baseTaskType: segmentation
    runner:
      startMethod: python_script
      target: backend/trainers/train_segmentation.py
      targetEnvVar: SEGMENTATION_SCRIPT_PATH
    mlflow:
      metric: val_iou
      mode: max
      modelName: segmentation-best-model
      artifactPath: model
    fieldOrder:
      - run_name
      - dataset_root
      - output_root
      - checkpoint_dir
      - tensorboard_dir
      - epochs
      - batch_size
      - learning_rate
      - num_workers
      - seed
      - gpu_ids
      - use_amp
      - force_cpu
      - save_every
      - encoder_name
      - num_classes
      - input_height
      - input_width
      - dice_weight
      - ce_weight
      - steps_per_epoch
      - mlflow_tracking_uri
      - mlflow_experiment
    fieldOverrides:
      run_name:
        default: seg-quick-run
      encoder_name:
        default: tiny-unet-like
`

export function getStarterTemplate(preset: StarterPreset): string {
  if (preset === 'classification') return CLASSIFICATION_CATALOG_TEMPLATE
  if (preset === 'segmentation') return SEGMENTATION_CATALOG_TEMPLATE
  return FULL_CATALOG_TEMPLATE
}

export function defaultBuilderDraft(baseTaskType: BaseTaskType): BuilderDraft {
  if (baseTaskType === 'segmentation') {
    return {
      taskType: 'segmentation',
      title: 'Segmentation',
      description: 'Semantic segmentation trainer',
      enabled: true,
      baseTaskType,
      runnerTarget: 'backend/trainers/train_segmentation.py',
      metric: 'val_iou',
      mode: 'max',
    }
  }

  return {
    taskType: 'classification',
    title: 'Classification',
    description: 'Image classification trainer',
    enabled: true,
    baseTaskType,
    runnerTarget: 'backend/trainers/train_classification.py',
    metric: 'val_accuracy',
    mode: 'max',
  }
}

export function switchBuilderBaseTask(previous: BuilderDraft, nextBaseTaskType: BaseTaskType): BuilderDraft {
  const nextPreset = defaultBuilderDraft(nextBaseTaskType)
  const previousPreset = defaultBuilderDraft(previous.baseTaskType)
  return {
    ...previous,
    baseTaskType: nextBaseTaskType,
    runnerTarget: nextPreset.runnerTarget,
    metric: nextPreset.metric,
    mode: nextPreset.mode,
    taskType: previous.taskType === previous.baseTaskType ? nextPreset.taskType : previous.taskType,
    title: previous.title === previousPreset.title ? nextPreset.title : previous.title,
    description: previous.description === previousPreset.description ? nextPreset.description : previous.description,
  }
}

export function defaultStudioDrafts(): BuilderDraft[] {
  return [defaultBuilderDraft('classification'), defaultBuilderDraft('segmentation')]
}

export function studioDraftsForPreset(preset: StarterPreset): BuilderDraft[] {
  if (preset === 'classification') return [defaultBuilderDraft('classification')]
  if (preset === 'segmentation') return [defaultBuilderDraft('segmentation')]
  return defaultStudioDrafts()
}

export function buildTaskSnippet(draft: BuilderDraft): string {
  const safeTaskType = draft.taskType.trim() || draft.baseTaskType
  const safeTitle = draft.title.trim() || safeTaskType
  const safeDescription =
    draft.description.trim() ||
    (draft.baseTaskType === 'segmentation' ? 'Semantic segmentation trainer' : 'Image classification trainer')
  const safeRunnerTarget = draft.runnerTarget.trim()
  const safeMetric = draft.metric.trim() || (draft.baseTaskType === 'segmentation' ? 'val_iou' : 'val_accuracy')
  const targetEnvVar = draft.baseTaskType === 'segmentation' ? 'SEGMENTATION_SCRIPT_PATH' : 'CLASSIFICATION_SCRIPT_PATH'
  const defaultModelName = `${safeTaskType}-best-model`
  const defaultRunName = draft.baseTaskType === 'segmentation' ? 'seg-quick-run' : 'clf-quick-run'
  const coreModelField = draft.baseTaskType === 'segmentation' ? 'encoder_name' : 'model_name'
  const coreModelDefault = draft.baseTaskType === 'segmentation' ? 'tiny-unet-like' : 'tiny-cnn'

  const lines = [
    '  - taskType: ' + safeTaskType,
    `    enabled: ${draft.enabled ? 'true' : 'false'}`,
    `    title: ${safeTitle}`,
    `    description: ${safeDescription}`,
    `    baseTaskType: ${draft.baseTaskType}`,
    '    runner:',
    '      startMethod: python_script',
    `      target: ${safeRunnerTarget}`,
    `      targetEnvVar: ${targetEnvVar}`,
    '    mlflow:',
    `      metric: ${safeMetric}`,
    `      mode: ${draft.mode}`,
    `      modelName: ${defaultModelName}`,
    '      artifactPath: model',
    '    fieldOrder:',
    '      - run_name',
    '      - dataset_root',
    '      - output_root',
    '      - checkpoint_dir',
    '      - tensorboard_dir',
    '      - epochs',
    '      - batch_size',
    '      - learning_rate',
    '      - num_workers',
    '      - seed',
    '      - gpu_ids',
    '      - use_amp',
    '      - force_cpu',
    '      - save_every',
    `      - ${coreModelField}`,
    '      - num_classes',
    '      - steps_per_epoch',
    '      - mlflow_tracking_uri',
    '      - mlflow_experiment',
    '    fieldOverrides:',
    '      run_name:',
    `        default: ${defaultRunName}`,
    `      ${coreModelField}:`,
    `        default: ${coreModelDefault}`,
  ]

  return lines.join('\n')
}

export function buildTaskBlockSnippet(drafts: BuilderDraft[]): string {
  const normalized = drafts.filter((draft) => {
    const taskType = draft.taskType.trim()
    return taskType.length > 0
  })
  if (normalized.length === 0) {
    return buildTaskSnippet(defaultBuilderDraft('classification'))
  }
  return normalized.map((draft) => buildTaskSnippet(draft)).join('\n\n')
}

export function buildCatalogSnippet(drafts: BuilderDraft[]): string {
  return `tasks:\n${buildTaskBlockSnippet(drafts)}\n`
}

function normalizeYamlScalar(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function inferBaseTaskTypeFromTaskType(taskType: string): BaseTaskType {
  const normalized = taskType.trim().toLowerCase()
  if (normalized.includes('seg')) return 'segmentation'
  return 'classification'
}

export function parseStudioTasksFromYaml(content: string): BuilderDraft[] {
  if (!content.trim()) return []

  const lines = content.split(/\r?\n/)
  const parsed: BuilderDraft[] = []
  let current: BuilderDraft | null = null
  let activeSection: 'runner' | 'mlflow' | null = null

  const pushCurrent = () => {
    if (!current) return
    parsed.push(current)
    current = null
    activeSection = null
  }

  for (const line of lines) {
    const taskTypeMatch = line.match(/^\s*-\s*taskType:\s*(.+?)\s*$/)
    if (taskTypeMatch) {
      pushCurrent()
      const taskType = normalizeYamlScalar(taskTypeMatch[1])
      const baseTaskType = inferBaseTaskTypeFromTaskType(taskType)
      const preset = defaultBuilderDraft(baseTaskType)
      current = {
        ...preset,
        taskType: taskType || preset.taskType,
      }
      continue
    }

    if (!current) continue

    const keyMatch = line.match(/^(\s*)([A-Za-z0-9_]+):\s*(.*?)\s*$/)
    if (!keyMatch) continue

    const indent = keyMatch[1].length
    const key = keyMatch[2]
    const rawValue = keyMatch[3]

    if (indent <= 2) {
      activeSection = null
      continue
    }

    if (indent === 4) {
      if (key === 'runner' && rawValue === '') {
        activeSection = 'runner'
        continue
      }
      if (key === 'mlflow' && rawValue === '') {
        activeSection = 'mlflow'
        continue
      }

      activeSection = null

      if (key === 'title') {
        const title = normalizeYamlScalar(rawValue)
        if (title) current.title = title
        continue
      }

      if (key === 'description') {
        current.description = normalizeYamlScalar(rawValue)
        continue
      }

      if (key === 'enabled') {
        const enabled = normalizeYamlScalar(rawValue).toLowerCase()
        if (enabled === 'true' || enabled === 'false') {
          current.enabled = enabled === 'true'
        }
        continue
      }

      if (key === 'baseTaskType') {
        const baseTaskType = normalizeYamlScalar(rawValue)
        if (baseTaskType === 'classification' || baseTaskType === 'segmentation') {
          const currentDraft: BuilderDraft = current
          const nextDraft: BuilderDraft = switchBuilderBaseTask(currentDraft, baseTaskType)
          current = {
            ...nextDraft,
            taskType: currentDraft.taskType,
            title: currentDraft.title,
          }
        }
        continue
      }
      continue
    }

    if (indent >= 6 && activeSection === 'runner' && key === 'target') {
      const target = normalizeYamlScalar(rawValue)
      if (target) current.runnerTarget = target
      continue
    }

    if (indent >= 6 && activeSection === 'mlflow') {
      if (key === 'metric') {
        const metric = normalizeYamlScalar(rawValue)
        if (metric) current.metric = metric
      } else if (key === 'mode') {
        const mode = normalizeYamlScalar(rawValue)
        if (mode === 'max' || mode === 'min') {
          current.mode = mode
        }
      }
    }
  }

  pushCurrent()
  return parsed
}

export function appendBlock(content: string, block: string): string {
  const nextBlock = block.trimEnd()
  if (!nextBlock) return content
  if (!content.trim()) return `tasks:\n${nextBlock}\n`

  if (!content.endsWith('\n')) {
    return `${content}\n\n${nextBlock}\n`
  }
  if (content.endsWith('\n\n')) {
    return `${content}${nextBlock}\n`
  }
  return `${content}\n${nextBlock}\n`
}

export function formatDate(value: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function parseTaskOutline(content: string): TaskOutlineItem[] {
  if (!content.trim()) return []
  const lines = content.split(/\r?\n/)
  const outline: TaskOutlineItem[] = []
  let offset = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const matched = line.match(/^\s*-\s*taskType:\s*['"]?([A-Za-z0-9._-]+)['"]?\s*$/)
    if (matched?.[1]) {
      outline.push({
        taskType: matched[1],
        line: index + 1,
        offset,
      })
    }
    offset += line.length + 1
  }

  return outline
}

export function findDuplicateTaskTypes(taskTypes: string[]): string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const raw of taskTypes) {
    const normalized = raw.trim()
    if (!normalized) continue
    if (seen.has(normalized)) duplicated.add(normalized)
    seen.add(normalized)
  }
  return Array.from(duplicated).sort()
}

export function collectStudioIssues(studioTasks: BuilderDraft[]): StudioIssue[] {
  const issues: StudioIssue[] = []
  const seenTaskType = new Map<string, number>()
  for (const [index, draft] of studioTasks.entries()) {
    const row = index + 1
    const taskType = draft.taskType.trim()
    const title = draft.title.trim()
    const description = draft.description.trim()
    const runnerTarget = draft.runnerTarget.trim()
    const metric = draft.metric.trim()

    if (!taskType) {
      issues.push({
        key: `taskType-${index}`,
        message: `Task #${row}: taskType is required.`,
      })
    } else if (seenTaskType.has(taskType)) {
      const firstIndex = seenTaskType.get(taskType)
      issues.push({
        key: `dup-${taskType}-${index}`,
        message: `Task #${row}: taskType "${taskType}" is duplicated with Task #${(firstIndex ?? 0) + 1}.`,
      })
    } else {
      seenTaskType.set(taskType, index)
    }

    if (!title) {
      issues.push({
        key: `title-${index}`,
        message: `Task #${row}: title is required.`,
      })
    }
    if (!description) {
      issues.push({
        key: `description-${index}`,
        message: `Task #${row}: description is required.`,
      })
    }
    if (!runnerTarget) {
      issues.push({
        key: `runner-${index}`,
        message: `Task #${row}: runner.target is required.`,
      })
    }
    if (!metric) {
      issues.push({
        key: `metric-${index}`,
        message: `Task #${row}: mlflow.metric is required.`,
      })
    }
  }
  return issues
}

export function parseLineNumberFromError(message: string | null | undefined): number | null {
  if (!message) return null
  const lineMatch = message.match(/line\s+(\d+)/i)
  if (!lineMatch) return null
  const parsed = Number.parseInt(lineMatch[1], 10)
  return Number.isNaN(parsed) ? null : Math.max(1, parsed)
}

export function offsetForLine(content: string, lineNumber: number): number {
  if (lineNumber <= 1) return 0
  const lines = content.split(/\r?\n/)
  let offset = 0
  const maxLine = Math.min(lineNumber - 1, lines.length)
  for (let index = 0; index < maxLine; index += 1) {
    offset += lines[index].length + 1
  }
  return offset
}
