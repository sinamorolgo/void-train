import { useMemo, useState } from 'react'

import type { MlflowRunItem, TaskType } from '../types'
import { SectionCard } from './SectionCard'

interface MlflowPanelProps {
  taskType: TaskType
  taskTitle: string
  runs: MlflowRunItem[]
  defaultMetric: string
  defaultMode: 'max' | 'min'
  defaultModelName: string
  defaultArtifactPath: string
  defaultTrackingUri: string
  defaultExperiment: string
  busy: boolean
  onSelectBest: (payload: {
    taskType: TaskType
    metric: string
    mode: 'max' | 'min'
    experimentName: string
    modelName: string
    registerToMlflow: boolean
    artifactPath: string
  }) => void
  onMigrateTensorBoard: (payload: {
    tensorboardDir: string
    trackingUri: string
    experimentName: string
    runName: string
  }) => void
}

export function MlflowPanel({
  taskType,
  taskTitle,
  runs,
  defaultMetric,
  defaultMode,
  defaultModelName,
  defaultArtifactPath,
  defaultTrackingUri,
  defaultExperiment,
  busy,
  onSelectBest,
  onMigrateTensorBoard,
}: MlflowPanelProps) {
  const [metric, setMetric] = useState(defaultMetric)
  const [mode, setMode] = useState<'max' | 'min'>(defaultMode)
  const [modelName, setModelName] = useState(defaultModelName)
  const [artifactPath, setArtifactPath] = useState(defaultArtifactPath)

  const [tbDir, setTbDir] = useState('./outputs/tensorboard')
  const [trackingUri, setTrackingUri] = useState(defaultTrackingUri)
  const [experimentName, setExperimentName] = useState(defaultExperiment)
  const [tbRunName, setTbRunName] = useState('tb-import')

  const rows = useMemo(() => runs.slice(0, 8), [runs])

  return (
    <SectionCard title="MLflow Ops" subtitle="베스트 런 선택, 모델 등록, 최근 런 확인 등 MLflow 운영 작업을 관리합니다.">
      <div className="mlflow-grid">
        <div className="mini-card">
          <h3>Best Model Picker</h3>
          <div className="compact-fields">
            <label>
              Metric
              <input
                name="metric"
                autoComplete="off"
                value={metric}
                onChange={(event) => setMetric(event.target.value)}
                placeholder={defaultMetric}
              />
            </label>
            <label>
              Mode
              <select
                name="mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as 'max' | 'min')}
              >
                <option value="max">max</option>
                <option value="min">min</option>
              </select>
            </label>
            <label>
              Model Name
              <input
                name="model_name"
                autoComplete="off"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
              />
            </label>
            <label>
              Artifact Path
              <input
                name="artifact_path"
                autoComplete="off"
                value={artifactPath}
                onChange={(event) => setArtifactPath(event.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              onSelectBest({
                taskType,
                metric,
                mode,
                experimentName,
                modelName,
                registerToMlflow: true,
                artifactPath,
              })
            }
            disabled={busy}
          >
            Pick & Register Best
          </button>
        </div>

        <div className="mini-card">
          <h3>TensorBoard → MLflow</h3>
          <div className="compact-fields">
            <label>
              TensorBoard Dir
              <input
                name="tensorboard_dir"
                autoComplete="off"
                value={tbDir}
                onChange={(event) => setTbDir(event.target.value)}
              />
            </label>
            <label>
              Tracking URI
              <input
                name="tracking_uri"
                autoComplete="off"
                value={trackingUri}
                onChange={(event) => setTrackingUri(event.target.value)}
              />
            </label>
            <label>
              Experiment Name
              <input
                name="experiment_name"
                autoComplete="off"
                value={experimentName}
                onChange={(event) => setExperimentName(event.target.value)}
              />
            </label>
            <label>
              Run Name
              <input
                name="tb_run_name"
                autoComplete="off"
                value={tbRunName}
                onChange={(event) => setTbRunName(event.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              onMigrateTensorBoard({
                tensorboardDir: tbDir,
                trackingUri,
                experimentName,
                runName: tbRunName,
              })
            }
            disabled={busy}
          >
            Import TensorBoard Scalars
          </button>
        </div>
      </div>

      <div className="mini-card table-card">
        <h3>Recent MLflow Runs ({taskTitle})</h3>
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Metric</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  아직 MLflow 런이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((run) => {
                const keyMetric = run.metrics[defaultMetric]
                return (
                  <tr key={run.runId}>
                    <td>{run.runName}</td>
                    <td>{run.status}</td>
                    <td>{keyMetric !== undefined ? keyMetric.toFixed(4) : '-'}</td>
                    <td>{new Date(run.startTime).toLocaleString()}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
