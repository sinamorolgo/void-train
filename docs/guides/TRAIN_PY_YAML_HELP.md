# Train.py Path & YAML Help

외부 `train.py`를 Control Deck에 연결할 때 필요한 설정만 빠르게 정리한 문서입니다.

## 1) 어디를 수정하나

- 기본 catalog 파일: `backend/config/training_catalog.yaml`
- 웹에서 반영 순서:
1. `YAML Catalog` 탭에서 내용 수정
2. `Validate YAML`
3. `Save & Apply`

## 2) 최소 task 설정 예시

```yaml
tasks:
  - taskType: classification-custom
    enabled: true
    title: Classification (Custom)
    description: External classifier trainer
    baseTaskType: classification
    runner:
      startMethod: python_script
      target: /abs/path/to/your/train.py
    mlflow:
      metric: val_accuracy
      mode: max
      modelName: classification-best-model
      artifactPath: model
    fieldOrder:
      - run_name
      - dataset_root
      - epochs
      - batch_size
      - learning_rate
      - mlflow_tracking_uri
      - mlflow_experiment
```

`taskType`는 UI 식별자이므로 중복되면 안 됩니다.

## 3) `runner` 항목 규약

- `startMethod`
  - `python_script`: 파일 경로 실행 (`python /path/train.py ...`)
  - `python_module`: 모듈 실행 (`python -m package.module ...`)
- `target`
  - 스크립트 경로 또는 모듈 경로
- `targetEnvVar` (선택)
  - 설정 시 해당 환경변수가 있으면 `target`보다 우선
- `cwd` (선택)
  - 실행 작업 디렉토리

## 4) 커스텀 CLI 인자 추가 (`extraFields`)

`extraFields`를 추가하면 Run Launcher에 입력 UI가 생기고, 실행 시 CLI 인자로 전달됩니다.

```yaml
extraFields:
  - name: train_profile
    valueType: str
    required: true
    default: quick
    type: select
    choices: [quick, full]
    cliArg: --train-profile
  - name: use_ema
    valueType: bool
    default: false
```

위 예시는 실행 시 `--train-profile quick --use-ema false` 형태로 전달됩니다.

## 5) `train.py`에서 맞춰야 할 규약

1. catalog에서 넘기는 기본 인자 + `extraFields` 인자를 파싱해야 합니다.
2. 진행률은 stdout으로 `VTM_PROGRESS::` + JSON 한 줄 출력 형식을 지켜야 합니다.
3. MLflow run id는 `VTM_RUN_META::` + JSON(`mlflow_run_id`)으로 출력하면 UI 연동이 됩니다.
4. 실시간 반영을 위해 `print(..., flush=True)`를 권장합니다.

예시:

```python
import json

print("VTM_RUN_META::" + json.dumps({"mlflow_run_id": run_id}), flush=True)
print(
    "VTM_PROGRESS::" + json.dumps(
        {"epoch": epoch, "total_epochs": epochs, "val_accuracy": val_acc, "device": "cuda:0"}
    ),
    flush=True,
)
```

## 6) 자주 발생하는 문제

- `Training script not found`
  - `runner.target` 경로 오타 또는 상대경로 기준 불일치
- run 시작 직후 실패
  - `argparse`가 알 수 없는 인자를 받아 종료한 경우가 많음 (`extraFields`와 스크립트 인자 파서 불일치)
- 진행률이 0%로 멈춤
  - `VTM_PROGRESS::` prefix 출력 누락 또는 JSON 형식 오류
