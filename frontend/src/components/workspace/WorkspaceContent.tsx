import type { ComponentProps } from 'react'

import { CatalogManagerPanel } from '../CatalogManagerPanel'
import { CatalogStudioPanel } from '../CatalogStudioPanel'
import { OperationsWorkspace, type OperationsWorkspaceProps } from './OperationsWorkspace'
import type { AppView } from '../../hooks/useWorkspaceTabs'

interface WorkspaceContentProps {
  activeView: AppView
  catalogPanelProps: ComponentProps<typeof CatalogManagerPanel>
  studioPanelProps: ComponentProps<typeof CatalogStudioPanel>
  operationsPanelProps: OperationsWorkspaceProps
}

export function WorkspaceContent({
  activeView,
  catalogPanelProps,
  studioPanelProps,
  operationsPanelProps,
}: WorkspaceContentProps) {
  return (
    <main id="main-content" className="workspace-main">
      {activeView === 'catalog' ? (
        <section id="panel-catalog" role="tabpanel" aria-labelledby="tab-catalog">
          <CatalogManagerPanel {...catalogPanelProps} />
        </section>
      ) : activeView === 'studio' ? (
        <section id="panel-studio" role="tabpanel" aria-labelledby="tab-studio">
          <CatalogStudioPanel {...studioPanelProps} />
        </section>
      ) : (
        <section id="panel-operations" role="tabpanel" aria-labelledby="tab-operations">
          <OperationsWorkspace {...operationsPanelProps} />
        </section>
      )}
    </main>
  )
}
