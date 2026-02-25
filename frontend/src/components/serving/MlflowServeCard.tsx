import type { MlflowServeServer } from '../../types'

interface MlflowServeCardProps {
  modelUri: string
  host: string
  port: number
  busy: boolean
  servers: MlflowServeServer[]
  onModelUriChange: (value: string) => void
  onHostChange: (value: string) => void
  onPortChange: (value: number) => void
  onStart: () => void
  onStop: (serverId: string) => void
}

export function MlflowServeCard({
  modelUri,
  host,
  port,
  busy,
  servers,
  onModelUriChange,
  onHostChange,
  onPortChange,
  onStart,
  onStop,
}: MlflowServeCardProps) {
  return (
    <div className="mini-card">
      <h3>MLflow Native Serve</h3>
      <div className="compact-fields">
        <label>
          Model URI
          <input
            name="serve_model_uri"
            autoComplete="off"
            value={modelUri}
            onChange={(event) => onModelUriChange(event.target.value)}
          />
        </label>
        <label>
          Host
          <input
            name="serve_host"
            autoComplete="off"
            value={host}
            onChange={(event) => onHostChange(event.target.value)}
          />
        </label>
        <label>
          Port
          <input
            type="number"
            value={port}
            onChange={(event) => onPortChange(Number.parseInt(event.target.value, 10) || 7001)}
          />
        </label>
      </div>
      <button type="button" disabled={busy || !modelUri} onClick={onStart}>
        Start MLflow Serving
      </button>

      <ul className="inline-list">
        {servers.map((server) => (
          <li key={server.serverId}>
            <span>
              {server.modelUri} ({server.status})
            </span>
            {server.status === 'running' ? (
              <button type="button" onClick={() => onStop(server.serverId)}>
                stop
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
