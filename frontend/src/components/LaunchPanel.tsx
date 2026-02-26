import { useMemo } from 'react'

import { groupFields } from '../hooks/useSchemaDefaults'
import type { TaskSchema, TaskType } from '../types'
import { FieldInput } from './FieldInput'
import { SectionCard } from './SectionCard'

interface LaunchPanelProps {
  schemas: TaskSchema[]
  selectedTask: TaskType
  values: Record<string, unknown>
  onTaskChange: (task: TaskType) => void
  onFieldChange: (name: string, value: unknown) => void
  onLaunch: () => void
  isLaunching: boolean
}

export function LaunchPanel({
  schemas,
  selectedTask,
  values,
  onTaskChange,
  onFieldChange,
  onLaunch,
  isLaunching,
}: LaunchPanelProps) {
  const currentSchema = schemas.find((schema) => schema.taskType === selectedTask)

  const groupedFields = useMemo(
    () => (currentSchema ? groupFields(currentSchema) : []),
    [currentSchema],
  )

  const runnerText = currentSchema
    ? `${currentSchema.runner.startMethod} · ${currentSchema.runner.target}`
    : 'Task schema not loaded'

  return (
    <SectionCard
      title="Run Launcher"
      subtitle={`YAML 카탈로그 기반 설정으로 학습 실행을 통합 관리합니다. (${runnerText})`}
      action={
        <button type="button" className="primary" onClick={onLaunch} disabled={isLaunching || !currentSchema}>
          {isLaunching ? 'Launching…' : 'Start Training'}
        </button>
      }
    >
      <div className="task-switch" role="tablist" aria-label="Task type">
        {schemas.map((schema) => (
          <button
            key={schema.taskType}
            type="button"
            className={schema.taskType === selectedTask ? 'chip active' : 'chip'}
            onClick={() => onTaskChange(schema.taskType)}
          >
            {schema.title}
          </button>
        ))}
      </div>

      {groupedFields.map((group) => (
        <div key={group.group} className="field-group">
          <h3>{group.group}</h3>
          <div className="field-grid">
            {group.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={onFieldChange}
              />
            ))}
          </div>
        </div>
      ))}
    </SectionCard>
  )
}
