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

  return (
    <SectionCard
      title="Run Launcher"
      subtitle="Dataclass 기반 설정으로 분류/세그 학습을 통합 실행합니다."
      action={
        <button type="button" className="primary" onClick={onLaunch} disabled={isLaunching || !currentSchema}>
          {isLaunching ? 'Launching...' : 'Start Training'}
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
