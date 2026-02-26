import type { RegistryCatalogModel } from '../../../types'

interface RegistryModelTableProps {
  models: RegistryCatalogModel[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
}

export function RegistryModelTable({ models, selectedModelId, onSelectModel }: RegistryModelTableProps) {
  return (
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
            <tr key={item.id} className={item.id === selectedModelId ? 'selected' : ''}>
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
                <button type="button" onClick={() => onSelectModel(item.id)}>
                  Select
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
