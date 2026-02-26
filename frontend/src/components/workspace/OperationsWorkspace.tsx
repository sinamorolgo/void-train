import type { ComponentProps } from 'react'

import { LaunchPanel } from '../LaunchPanel'
import { MlflowPanel } from '../MlflowPanel'
import { RunsPanel } from '../RunsPanel'
import { ServingPanel } from '../ServingPanel'

export interface OperationsWorkspaceProps {
  launchPanelProps: ComponentProps<typeof LaunchPanel>
  runsPanelProps: ComponentProps<typeof RunsPanel>
  mlflowPanelProps: ComponentProps<typeof MlflowPanel>
  servingPanelProps: ComponentProps<typeof ServingPanel>
}

export function OperationsWorkspace({
  launchPanelProps,
  runsPanelProps,
  mlflowPanelProps,
  servingPanelProps,
}: OperationsWorkspaceProps) {
  return (
    <div className="operations-panel">
      <LaunchPanel {...launchPanelProps} />
      <RunsPanel {...runsPanelProps} />
      <MlflowPanel {...mlflowPanelProps} />
      <ServingPanel {...servingPanelProps} />
    </div>
  )
}
