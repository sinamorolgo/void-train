import { useState } from 'react'

import type { AppView } from '../../hooks/useWorkspaceTabs'

interface WorkspaceSidebarProps {
  activeView: AppView
  catalogDirty: boolean
  studioDirty: boolean
  onViewChange: (nextView: AppView) => void
}

interface WorkspaceNavItem {
  view: AppView
  id: string
  panelId: string
  label: string
  description: string
  dirtyKey?: 'catalog' | 'studio'
}

interface WorkspaceNavGroup {
  id: string
  label: string
  description: string
  items: WorkspaceNavItem[]
}

const NAV_GROUPS: WorkspaceNavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Run / monitor / serve',
    items: [
      {
        view: 'operations',
        id: 'tab-operations',
        panelId: 'panel-operations',
        label: 'Operations',
        description: 'Launch, runs, MLflow, serving',
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog Files',
    description: 'YAML authoring flow',
    items: [
      {
        view: 'catalog',
        id: 'tab-catalog',
        panelId: 'panel-catalog',
        label: 'YAML Catalog',
        description: 'Raw YAML editor',
        dirtyKey: 'catalog',
      },
      {
        view: 'studio',
        id: 'tab-studio',
        panelId: 'panel-studio',
        label: 'YAML Studio',
        description: 'Structured easy mode',
        dirtyKey: 'studio',
      },
    ],
  },
]

export function WorkspaceSidebar({ activeView, catalogDirty, studioDirty, onViewChange }: WorkspaceSidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    workspace: true,
    catalog: true,
  })

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-head">
        <p className="workspace-sidebar-eyebrow">Navigator</p>
        <h2>Workspace Map</h2>
      </div>

      <nav className="workspace-tree" aria-label="Workspace views">
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups[group.id] ?? true

          return (
            <section key={group.id} className="workspace-folder-group">
              <button
                type="button"
                className="workspace-folder"
                aria-expanded={isOpen}
                aria-controls={`workspace-folder-${group.id}`}
                onClick={() => {
                  setOpenGroups((previous) => ({
                    ...previous,
                    [group.id]: !isOpen,
                  }))
                }}
              >
                <span className="workspace-folder-glyph" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="workspace-folder-copy">
                  <strong>{group.label}</strong>
                  <small>{group.description}</small>
                </span>
              </button>

              <ul
                id={`workspace-folder-${group.id}`}
                className="workspace-folder-list"
                role="tablist"
                aria-orientation="vertical"
                data-open={isOpen ? 'true' : 'false'}
              >
                {group.items.map((item) => {
                  const isDirty = item.dirtyKey === 'catalog' ? catalogDirty : item.dirtyKey === 'studio' ? studioDirty : false
                  const isActive = activeView === item.view

                  return (
                    <li key={item.id}>
                      <button
                        id={item.id}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        aria-controls={item.panelId}
                        aria-label={isDirty ? `${item.label} (unsaved changes)` : item.label}
                        className="workspace-tree-tab"
                        data-active={isActive ? 'true' : 'false'}
                        onClick={() => onViewChange(item.view)}
                      >
                        <span className="workspace-tree-tab-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        {isDirty ? (
                          <span className="workspace-tree-status" aria-hidden="true">
                            ●
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </nav>
    </aside>
  )
}
