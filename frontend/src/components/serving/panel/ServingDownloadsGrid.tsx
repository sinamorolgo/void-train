import type { RayServeServer } from '../../../types'
import { DownloadFtpCard } from '../DownloadFtpCard'
import { DownloadMlflowCard } from '../DownloadMlflowCard'
import { RayServeCard } from '../RayServeCard'
import type { FtpDownloadFormState, MlflowDownloadFormState, RayServeFormState } from './types'

interface ServingDownloadsGridProps {
  busy: boolean
  rayServers: RayServeServer[]
  destinationDir: string
  mlflowDownloadForm: MlflowDownloadFormState
  ftpDownloadForm: FtpDownloadFormState
  rayServeForm: RayServeFormState
  onDestinationDirChange: (value: string) => void
  onPatchMlflowDownloadForm: (patch: Partial<MlflowDownloadFormState>) => void
  onPatchFtpDownloadForm: (patch: Partial<FtpDownloadFormState>) => void
  onPatchRayServeForm: (patch: Partial<RayServeFormState>) => void
  onDownloadFromMlflow: () => void
  onDownloadFromFtp: () => void
  onStartRayServing: () => void
  onStopRayServing: (serverId: string) => void
}

export function ServingDownloadsGrid({
  busy,
  rayServers,
  destinationDir,
  mlflowDownloadForm,
  ftpDownloadForm,
  rayServeForm,
  onDestinationDirChange,
  onPatchMlflowDownloadForm,
  onPatchFtpDownloadForm,
  onPatchRayServeForm,
  onDownloadFromMlflow,
  onDownloadFromFtp,
  onStartRayServing,
  onStopRayServing,
}: ServingDownloadsGridProps) {
  return (
    <div className="mlflow-grid">
      <DownloadMlflowCard
        trackingUri={mlflowDownloadForm.trackingUri}
        runId={mlflowDownloadForm.runId}
        artifactPath={mlflowDownloadForm.artifactPath}
        destinationDir={destinationDir}
        busy={busy}
        onTrackingUriChange={(value) => onPatchMlflowDownloadForm({ trackingUri: value })}
        onRunIdChange={(value) => onPatchMlflowDownloadForm({ runId: value })}
        onArtifactPathChange={(value) => onPatchMlflowDownloadForm({ artifactPath: value })}
        onDestinationDirChange={onDestinationDirChange}
        onDownload={onDownloadFromMlflow}
      />

      <DownloadFtpCard
        host={ftpDownloadForm.host}
        port={ftpDownloadForm.port}
        username={ftpDownloadForm.username}
        password={ftpDownloadForm.password}
        remotePath={ftpDownloadForm.remotePath}
        destinationDir={destinationDir}
        busy={busy}
        onHostChange={(value) => onPatchFtpDownloadForm({ host: value })}
        onPortChange={(value) => onPatchFtpDownloadForm({ port: value })}
        onUsernameChange={(value) => onPatchFtpDownloadForm({ username: value })}
        onPasswordChange={(value) => onPatchFtpDownloadForm({ password: value })}
        onRemotePathChange={(value) => onPatchFtpDownloadForm({ remotePath: value })}
        onDestinationDirChange={onDestinationDirChange}
        onDownload={onDownloadFromFtp}
      />

      <RayServeCard
        modelUri={rayServeForm.modelUri}
        host={rayServeForm.host}
        port={rayServeForm.port}
        appName={rayServeForm.appName}
        routePrefix={rayServeForm.routePrefix}
        busy={busy}
        servers={rayServers}
        onModelUriChange={(value) => onPatchRayServeForm({ modelUri: value })}
        onHostChange={(value) => onPatchRayServeForm({ host: value })}
        onPortChange={(value) => onPatchRayServeForm({ port: value })}
        onAppNameChange={(value) => onPatchRayServeForm({ appName: value })}
        onRoutePrefixChange={(value) => onPatchRayServeForm({ routePrefix: value })}
        onStart={onStartRayServing}
        onStop={onStopRayServing}
      />
    </div>
  )
}
