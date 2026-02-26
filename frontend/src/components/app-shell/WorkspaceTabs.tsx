import type { AppView } from '../../hooks/useWorkspaceTabs'

interface WorkspaceTabsProps {
  activeView: AppView
  catalogDirty: boolean
  studioDirty: boolean
  onViewChange: (nextView: AppView) => void
}

const TABS: Array<{
  view: AppView
  id: string
  panelId: string
  label: string
  dirtyKey?: 'catalog' | 'studio'
}> = [
  {
    view: 'operations',
    id: 'tab-operations',
    panelId: 'panel-operations',
    label: 'Operations',
  },
  {
    view: 'catalog',
    id: 'tab-catalog',
    panelId: 'panel-catalog',
    label: 'YAML Catalog',
    dirtyKey: 'catalog',
  },
  {
    view: 'studio',
    id: 'tab-studio',
    panelId: 'panel-studio',
    label: 'YAML Studio',
    dirtyKey: 'studio',
  },
]

export function WorkspaceTabs({ activeView, catalogDirty, studioDirty, onViewChange }: WorkspaceTabsProps) {
  return (
    <nav className="view-tabs" aria-label="Workspace tabs" role="tablist">
      {TABS.map((tab) => {
        const dirty = tab.dirtyKey === 'catalog' ? catalogDirty : tab.dirtyKey === 'studio' ? studioDirty : false
        return (
          <button
            key={tab.id}
            id={tab.id}
            role="tab"
            type="button"
            aria-selected={activeView === tab.view}
            aria-controls={tab.panelId}
            aria-label={dirty ? `${tab.label} (unsaved changes)` : tab.label}
            className={`view-tab ${activeView === tab.view ? 'active' : ''}`}
            onClick={() => onViewChange(tab.view)}
          >
            {tab.label}
            {dirty ? ' •' : ''}
          </button>
        )
      })}
    </nav>
  )
}
