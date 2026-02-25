import type { RunItem } from '../types'
import { SectionCard } from './SectionCard'

interface RunsPanelProps {
  runs: RunItem[]
  onStop: (runId: string) => void
  isStopping: boolean
}

function progressPercent(run: RunItem): number {
  const epoch = Number(run.progress.epoch ?? 0)
  const total = Number(run.progress.total_epochs ?? 0)
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((epoch / total) * 100)))
}

export function RunsPanel({ runs, onStop, isStopping }: RunsPanelProps) {
  return (
    <SectionCard title="Live Runs" subtitle="실행 중/완료된 학습 로그와 진행률을 추적합니다.">
      <div className="runs-grid">
        {runs.length === 0 ? <p className="empty">아직 실행된 런이 없습니다.</p> : null}

        {runs.map((run) => {
          const percent = progressPercent(run)
          const metric =
            run.progress.val_accuracy ??
            run.progress.val_iou ??
            run.progress.best_val_accuracy ??
            run.progress.best_val_iou

          return (
            <article key={run.runId} className="run-card">
              <header>
                <div>
                  <strong>{run.config.run_name ? String(run.config.run_name) : run.runId.slice(0, 8)}</strong>
                  <p>
                    {run.taskType} · {run.status}
                  </p>
                </div>
                {run.status === 'running' ? (
                  <button type="button" onClick={() => onStop(run.runId)} disabled={isStopping}>
                    Stop
                  </button>
                ) : null}
              </header>

              <div className="progress-wrap" aria-label="training progress">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>

              <dl className="meta-grid">
                <div>
                  <dt>Epoch</dt>
                  <dd>
                    {run.progress.epoch ?? '-'} / {run.progress.total_epochs ?? '-'}
                  </dd>
                </div>
                <div>
                  <dt>Metric</dt>
                  <dd>{metric !== undefined ? Number(metric).toFixed(4) : '-'}</dd>
                </div>
                <div>
                  <dt>Device</dt>
                  <dd>{run.progress.device ?? '-'}</dd>
                </div>
                <div>
                  <dt>MLflow</dt>
                  <dd>{run.mlflowRunId ? run.mlflowRunId.slice(0, 8) : '-'}</dd>
                </div>
              </dl>

              <details>
                <summary>Recent logs</summary>
                <pre>{run.logs.slice(-10).join('\n')}</pre>
              </details>
            </article>
          )
        })}
      </div>
    </SectionCard>
  )
}
