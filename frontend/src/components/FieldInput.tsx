import type { ChangeEvent } from 'react'

import type { ConfigField } from '../types'

interface FieldInputProps {
  field: ConfigField
  value: unknown
  onChange: (name: string, value: unknown) => void
}

export function FieldInput({ field, value, onChange }: FieldInputProps) {
  const id = `field-${field.name}`
  const checked = value === true

  const handleTextOrNumber = (event: ChangeEvent<HTMLInputElement>) => {
    if (field.type === 'number') {
      const parsed = field.valueType === 'int' ? Number.parseInt(event.target.value, 10) : Number.parseFloat(event.target.value)
      onChange(field.name, Number.isNaN(parsed) ? '' : parsed)
      return
    }

    onChange(field.name, event.target.value)
  }

  const renderControl = () => {
    if (field.type === 'boolean') {
      return (
        <label className="boolean-input" htmlFor={id}>
          <input
            id={id}
            name={field.name}
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(field.name, event.target.checked)}
          />
          <span>{checked ? 'Enabled' : 'Disabled'}</span>
        </label>
      )
    }

    if (field.type === 'select') {
      return (
        <select
          id={id}
          name={field.name}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.name, event.target.value)}
        >
          {(field.choices ?? []).map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      )
    }

    return (
      <input
        id={id}
        name={field.name}
        type={field.type}
        value={String(value ?? '')}
        min={field.min}
        max={field.max}
        step={field.step}
        required={field.required}
        autoComplete="off"
        onChange={handleTextOrNumber}
        placeholder={field.label}
      />
    )
  }

  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      {renderControl()}
      <p>{field.description}</p>
    </div>
  )
}
