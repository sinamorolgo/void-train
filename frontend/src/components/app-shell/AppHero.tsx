interface AppHeroProps {
  running: number
  completed: number
  taskLabel: string
}

export function AppHero({ running, completed, taskLabel }: AppHeroProps) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Void Train Manager</p>
        <h1>PyTorch Trainer Control Deck</h1>
        <p>TensorBoard 기반 워크플로를 유지하면서 MLflow 중심 운영으로 전환할 수 있는 통합 UI입니다.</p>
      </div>
      <div className="hero-stats">
        <article>
          <span>Running</span>
          <strong>{running}</strong>
        </article>
        <article>
          <span>Completed</span>
          <strong>{completed}</strong>
        </article>
        <article>
          <span>Task</span>
          <strong>{taskLabel}</strong>
        </article>
      </div>
    </header>
  )
}
