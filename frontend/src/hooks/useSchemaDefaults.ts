import type { TaskSchema } from '../types'

export function buildDefaults(schema: TaskSchema): Record<string, unknown> {
  return schema.fields.reduce<Record<string, unknown>>((acc, field) => {
    if (field.default !== null && field.default !== undefined) {
      acc[field.name] = field.default
      return acc
    }

    if (field.type === 'boolean') {
      acc[field.name] = false
      return acc
    }

    acc[field.name] = ''
    return acc
  }, {})
}

export function groupFields(schema: TaskSchema): Array<{ group: string; fields: TaskSchema['fields'] }> {
  const grouped = new Map<string, TaskSchema['fields']>()

  for (const field of schema.fields) {
    const current = grouped.get(field.group) ?? []
    current.push(field)
    grouped.set(field.group, current)
  }

  return Array.from(grouped.entries()).map(([group, fields]) => ({ group, fields }))
}
