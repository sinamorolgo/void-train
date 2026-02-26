import type { TaskOutlineItem } from '../../catalogManagerUtils'

interface NavigatorPreviewTabProps {
  taskOutline: TaskOutlineItem[]
  onJumpToOffset: (offset: number) => void
}

export function NavigatorPreviewTab({ taskOutline, onJumpToOffset }: NavigatorPreviewTabProps) {
  return (
    <>
      <section className="catalog-outline">
        <h4>Task Navigator</h4>
        <p>`- taskType:` 블록을 기준으로 YAML 위치를 빠르게 이동합니다.</p>
        {taskOutline.length === 0 ? (
          <p className="empty">task 블록을 찾지 못했습니다.</p>
        ) : (
          <ul className="catalog-outline-list">
            {taskOutline.map((item) => (
              <li key={`${item.taskType}-${item.line}`}>
                <button type="button" className="outline-jump" onClick={() => onJumpToOffset(item.offset)}>
                  <span>{item.taskType}</span>
                  <small>line {item.line}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="catalog-tips">
        <h4>Quick Rules</h4>
        <ul>
          <li>`tasks`는 리스트여야 합니다.</li>
          <li>`runner.target`은 실제 train 스크립트/모듈 경로를 가리켜야 합니다.</li>
          <li>`fieldOverrides`에서 UI 라벨/기본값/설명을 제어할 수 있습니다.</li>
          <li>`mlflow.metric` + `mode`로 best 모델 선택 기준을 바꿉니다.</li>
        </ul>
      </section>
    </>
  )
}
