interface CatalogQuickFlowProps {
  composeReady: boolean
  validateReady: boolean
  saveReady: boolean
  dirty: boolean
  message: string
}

export function CatalogQuickFlow({
  composeReady,
  validateReady,
  saveReady,
  dirty,
  message,
}: CatalogQuickFlowProps) {
  return (
    <section className="catalog-quickflow" aria-label="Catalog quick flow">
      <ol className="catalog-quickflow-steps">
        <li className={`catalog-quickflow-step ${composeReady ? 'done' : 'current'}`}>
          <span>1</span>
          <div>
            <strong>Compose</strong>
            <small>YAML 작성 또는 Preset 적용</small>
          </div>
        </li>
        <li
          className={`catalog-quickflow-step ${
            validateReady ? 'done' : composeReady ? 'current' : 'pending'
          }`}
        >
          <span>2</span>
          <div>
            <strong>Validate</strong>
            <small>Catalog schema 검증</small>
          </div>
        </li>
        <li
          className={`catalog-quickflow-step ${
            saveReady ? 'done' : validateReady && dirty ? 'current' : 'pending'
          }`}
        >
          <span>3</span>
          <div>
            <strong>Save</strong>
            <small>런타임 설정 반영</small>
          </div>
        </li>
      </ol>
      <p className="muted">{message}</p>
    </section>
  )
}
