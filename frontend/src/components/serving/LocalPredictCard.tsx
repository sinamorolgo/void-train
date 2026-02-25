interface LocalPredictCardProps {
  alias: string
  inputJson: string
  busy: boolean
  onAliasChange: (value: string) => void
  onInputJsonChange: (value: string) => void
  onPredict: () => void
}

export function LocalPredictCard({
  alias,
  inputJson,
  busy,
  onAliasChange,
  onInputJsonChange,
  onPredict,
}: LocalPredictCardProps) {
  return (
    <div className="mini-card">
      <h3>Local Predict</h3>
      <div className="compact-fields">
        <label>
          Alias
          <input
            name="predict_alias"
            autoComplete="off"
            value={alias}
            onChange={(event) => onAliasChange(event.target.value)}
          />
        </label>
        <label>
          Inputs (JSON)
          <textarea
            name="predict_inputs"
            autoComplete="off"
            rows={6}
            value={inputJson}
            onChange={(event) => onInputJsonChange(event.target.value)}
          />
        </label>
      </div>
      <button type="button" disabled={busy || !alias} onClick={onPredict}>
        Run Predict
      </button>
    </div>
  )
}
