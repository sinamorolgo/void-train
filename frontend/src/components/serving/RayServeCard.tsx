import type { RayServeServer } from '../../types'

interface RayServeCardProps {
  modelUri: string
  host: string
  port: number
  appName: string
  routePrefix: string
  busy: boolean
  servers: RayServeServer[]
  onModelUriChange: (value: string) => void
  onHostChange: (value: string) => void
  onPortChange: (value: number) => void
  onAppNameChange: (value: string) => void
  onRoutePrefixChange: (value: string) => void
  onStart: () => void
  onStop: (serverId: string) => void
}

export function RayServeCard({
  modelUri,
  host,
  port,
  appName,
  routePrefix,
  busy,
  servers,
  onModelUriChange,
  onHostChange,
  onPortChange,
  onAppNameChange,
  onRoutePrefixChange,
  onStart,
  onStop,
}: RayServeCardProps) {
  return (
    <div className="mini-card">
      <h3>Ray Serve</h3>
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
        <label>
          App Name
          <input
            name="serve_app_name"
            autoComplete="off"
            value={appName}
            onChange={(event) => onAppNameChange(event.target.value)}
          />
        </label>
        <label>
          Route Prefix
          <input
            name="serve_route_prefix"
            autoComplete="off"
            value={routePrefix}
            onChange={(event) => onRoutePrefixChange(event.target.value)}
          />
        </label>
      </div>
      <button type="button" disabled={busy || !modelUri} onClick={onStart}>
        Start Ray Serving
      </button>

      <ul className="inline-list">
        {servers.map((server) => (
          <li key={server.serverId}>
            <span>
              {server.modelUri} {server.routePrefix} ({server.status})
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
