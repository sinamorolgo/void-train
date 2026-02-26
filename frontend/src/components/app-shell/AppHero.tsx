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
        <h1>Control Deck</h1>
        <p>MLflow 기반 학습 실행, 추적, 모델 운영 작업을 한 화면에서 관리하는 통합 UI입니다.</p>
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
