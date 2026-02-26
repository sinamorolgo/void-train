import { useQueryClient } from '@tanstack/react-query'

import './App.css'
import { AppHero } from './components/app-shell/AppHero'
import { NoticeStack } from './components/app-shell/NoticeStack'
import { WorkspaceSidebar } from './components/app-shell/WorkspaceSidebar'
import { WorkspaceContent } from './components/workspace/WorkspaceContent'
import { useCatalogWorkspace } from './hooks/useCatalogWorkspace'
import { useNoticeCenter } from './hooks/useNoticeCenter'
import { useOperationsWorkspace } from './hooks/useOperationsWorkspace'
import { useWorkspaceTabs } from './hooks/useWorkspaceTabs'

export default function App() {
  const queryClient = useQueryClient()
  const { notices, pushNotice } = useNoticeCenter()

  const catalogWorkspace = useCatalogWorkspace({
    queryClient,
    pushNotice,
  })

  const operationsWorkspace = useOperationsWorkspace({
    queryClient,
    pushNotice,
  })

  const { activeView, handleViewChange } = useWorkspaceTabs({
    catalogDirty: catalogWorkspace.catalogDirty,
    studioDirty: catalogWorkspace.studioDirty,
  })

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to Main Content
      </a>

      <AppHero
        running={operationsWorkspace.headline.running}
        completed={operationsWorkspace.headline.finished}
        taskLabel={operationsWorkspace.selectedTaskLabel}
      />

      {operationsWorkspace.schemasErrorMessage ? (
        <p className="error-banner">Schema load failed: {operationsWorkspace.schemasErrorMessage}</p>
      ) : null}

      <div className="workspace-layout">
        <WorkspaceSidebar
          activeView={activeView}
          catalogDirty={catalogWorkspace.catalogDirty}
          studioDirty={catalogWorkspace.studioDirty}
          onViewChange={handleViewChange}
        />

        <WorkspaceContent
          activeView={activeView}
          catalogPanelProps={catalogWorkspace.catalogPanelProps}
          studioPanelProps={catalogWorkspace.studioPanelProps}
          operationsPanelProps={operationsWorkspace.operationsPanelProps}
        />
      </div>

      <NoticeStack notices={notices} />
    </div>
  )
}
