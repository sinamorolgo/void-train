interface DownloadFtpCardProps {
  host: string
  port: number
  username: string
  password: string
  remotePath: string
  destinationDir: string
  busy: boolean
  onHostChange: (value: string) => void
  onPortChange: (value: number) => void
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onRemotePathChange: (value: string) => void
  onDestinationDirChange: (value: string) => void
  onDownload: () => void
}

export function DownloadFtpCard({
  host,
  port,
  username,
  password,
  remotePath,
  destinationDir,
  busy,
  onHostChange,
  onPortChange,
  onUsernameChange,
  onPasswordChange,
  onRemotePathChange,
  onDestinationDirChange,
  onDownload,
}: DownloadFtpCardProps) {
  return (
    <div className="mini-card">
      <h3>Download (FTP Fallback)</h3>
      <div className="compact-fields">
        <label>
          Host
          <input name="ftp_host" autoComplete="off" value={host} onChange={(event) => onHostChange(event.target.value)} />
        </label>
        <label>
          Port
          <input
            type="number"
            value={port}
            onChange={(event) => onPortChange(Number.parseInt(event.target.value, 10) || 21)}
          />
        </label>
        <label>
          Username
          <input
            name="ftp_username"
            autoComplete="off"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="ftp_password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
        <label>
          Remote Path
          <input
            name="ftp_remote_path"
            autoComplete="off"
            value={remotePath}
            onChange={(event) => onRemotePathChange(event.target.value)}
          />
        </label>
        <label>
          Destination
          <input
            name="ftp_destination"
            autoComplete="off"
            value={destinationDir}
            onChange={(event) => onDestinationDirChange(event.target.value)}
          />
        </label>
      </div>
      <button type="button" disabled={busy || !host || !remotePath || !username} onClick={onDownload}>
        Download from FTP
      </button>
    </div>
  )
}
