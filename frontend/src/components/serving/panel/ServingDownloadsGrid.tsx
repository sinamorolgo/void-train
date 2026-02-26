import type { MlflowServeServer } from '../../../types'
import { DownloadFtpCard } from '../DownloadFtpCard'
import { DownloadMlflowCard } from '../DownloadMlflowCard'
import { MlflowServeCard } from '../MlflowServeCard'
import type { FtpDownloadFormState, MlflowDownloadFormState, MlflowServeFormState } from './types'

interface ServingDownloadsGridProps {
  busy: boolean
  mlflowServers: MlflowServeServer[]
  destinationDir: string
  mlflowDownloadForm: MlflowDownloadFormState
  ftpDownloadForm: FtpDownloadFormState
  mlflowServeForm: MlflowServeFormState
  onDestinationDirChange: (value: string) => void
  onPatchMlflowDownloadForm: (patch: Partial<MlflowDownloadFormState>) => void
  onPatchFtpDownloadForm: (patch: Partial<FtpDownloadFormState>) => void
  onPatchMlflowServeForm: (patch: Partial<MlflowServeFormState>) => void
  onDownloadFromMlflow: () => void
  onDownloadFromFtp: () => void
  onStartMlflowServing: () => void
  onStopMlflowServing: (serverId: string) => void
}

export function ServingDownloadsGrid({
  busy,
  mlflowServers,
  destinationDir,
  mlflowDownloadForm,
  ftpDownloadForm,
  mlflowServeForm,
  onDestinationDirChange,
  onPatchMlflowDownloadForm,
  onPatchFtpDownloadForm,
  onPatchMlflowServeForm,
  onDownloadFromMlflow,
  onDownloadFromFtp,
  onStartMlflowServing,
  onStopMlflowServing,
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

      <MlflowServeCard
        modelUri={mlflowServeForm.modelUri}
        host={mlflowServeForm.host}
        port={mlflowServeForm.port}
        busy={busy}
        servers={mlflowServers}
        onModelUriChange={(value) => onPatchMlflowServeForm({ modelUri: value })}
        onHostChange={(value) => onPatchMlflowServeForm({ host: value })}
        onPortChange={(value) => onPatchMlflowServeForm({ port: value })}
        onStart={onStartMlflowServing}
        onStop={onStopMlflowServing}
      />
    </div>
  )
}
