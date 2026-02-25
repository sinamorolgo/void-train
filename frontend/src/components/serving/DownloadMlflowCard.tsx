interface DownloadMlflowCardProps {
  trackingUri: string
  runId: string
  artifactPath: string
  destinationDir: string
  busy: boolean
  onTrackingUriChange: (value: string) => void
  onRunIdChange: (value: string) => void
  onArtifactPathChange: (value: string) => void
  onDestinationDirChange: (value: string) => void
  onDownload: () => void
}

export function DownloadMlflowCard({
  trackingUri,
  runId,
  artifactPath,
  destinationDir,
  busy,
  onTrackingUriChange,
  onRunIdChange,
  onArtifactPathChange,
  onDestinationDirChange,
  onDownload,
}: DownloadMlflowCardProps) {
  return (
    <div className="mini-card">
      <h3>Download (MLflow)</h3>
      <div className="compact-fields">
        <label>
          Tracking URI
          <input
            name="download_tracking_uri"
            autoComplete="off"
            value={trackingUri}
            onChange={(event) => onTrackingUriChange(event.target.value)}
          />
        </label>
        <label>
          Run ID
          <input
            name="download_run_id"
            autoComplete="off"
            value={runId}
            onChange={(event) => onRunIdChange(event.target.value)}
            placeholder="mlflow run id"
          />
        </label>
        <label>
          Artifact Path
          <input
            name="download_artifact_path"
            autoComplete="off"
            value={artifactPath}
            onChange={(event) => onArtifactPathChange(event.target.value)}
          />
        </label>
        <label>
          Destination
          <input
            name="download_destination"
            autoComplete="off"
            value={destinationDir}
            onChange={(event) => onDestinationDirChange(event.target.value)}
          />
        </label>
      </div>
      <button type="button" disabled={busy || !runId} onClick={onDownload}>
        Download from MLflow
      </button>
    </div>
  )
}
