# Web Usage Guide (Captured UI)

`Void Train Manager`의 실제 웹 화면 기준 사용 가이드입니다.

## 1) Operations 화면

학습 실행/진행 확인/MLflow 작업을 한 화면에서 처리합니다.

![Operations Overview](../assets/web-usage/web-operations-overview.png)

핵심:

- `Run Launcher`: 분류/세그 학습 시작
- `Live Runs`: 실행 상태/로그 확인
- `MLflow Ops`: best run 선택, TensorBoard -> MLflow 이관

## 2) YAML Catalog 화면

코드 수정 없이 `training_catalog.yaml`을 검증/저장해 UI와 런타임을 동기화합니다.

![YAML Catalog](../assets/web-usage/web-yaml-catalog.png)

권장 순서:

1. `Validate YAML`
2. `Format YAML`
3. `Save & Apply`

`extraFields`를 task에 추가하면 `Run Launcher`에 동적 입력 폼이 자동 생성됩니다.

```yaml
tasks:
  - taskType: classification
    runner:
      startMethod: python_script
      target: /abs/path/to/your/train.py
    extraFields:
      - name: task_name
        valueType: str
        required: true
        default: classification
      - name: profile
        valueType: str
        type: select
        default: quick
        choices: [quick, full]
```

## 3) YAML Studio (Easy Mode)

YAML 전체를 직접 수정하지 않아도 task/registry를 폼으로 편집할 수 있습니다.

- 기본 필드: `taskType`, `runnerTarget`, `mlflowModelName` 등
- 고급 필드: `fieldOverrides (JSON object)`, `extraFields (JSON array)`
- 저장 조건: validation 통과 + JSON 파싱 오류 없음 + 편집값 반영 완료

외부 `train.py` 인자를 추가하려면 `extraFields`에 아래와 같이 작성합니다.

```json
[
  {
    "name": "task_name",
    "valueType": "str",
    "required": true,
    "default": "classification"
  },
  {
    "name": "profile",
    "valueType": "str",
    "type": "select",
    "default": "quick",
    "choices": ["quick", "full"]
  }
]
```

## 4) Model Registry Browser (모델별 stage/version 조회 + 다운로드)

`Model Serving` 하단에서 `registryModels` 기준 모델 목록을 보고 다운로드합니다.

![Model Registry Browser](../assets/web-usage/web-model-registry-browser.png)

다운로드 절차:

1. `Selected Model` 선택 (예: Classification / Segmentation)
2. `Stage` 선택 (`dev` 또는 `release`)
3. `Version` 선택 (`latest` 또는 특정 버전)
4. `Artifact` 선택 (`bundle.tar.gz`, `manifest.json`, `model-standard.pt`)
5. `Destination` 지정 후 `Download Selected Artifact`

## 5) FTP 등록 - 자동/수동

### A. Publish Best Run to FTP

MLflow 실험 이름과 metric/mode를 기준으로 베스트 run을 자동 선택해 FTP registry에 등록합니다.

1. `Tracking URI`, `Experiment Name` 확인
2. `Task Type`, `Metric`, `Mode` 선택
3. `Model Name`, `Stage`, `Artifact Path` 입력
4. 필요 시 `Convert to Torch Standard` 체크
5. `Pick Best + Publish`

### B. Upload .pth/.pt and Register

로컬 파일 경로를 서버에 맞춰 입력하지 않고, 브라우저에서 파일을 직접 업로드해 등록합니다.

1. `Model Name`, `Stage` 선택
2. `.pth/.pt` 파일 업로드
3. 필요 시 `Version`, `Torch Task Type`, `Num Classes`, `Notes` 입력
4. `Upload + Register`

## 6) 모델 추가/수정 (YAML 단일 관리)

`backend/config/training_catalog.yaml`의 `registryModels`를 수정하면 웹 목록에 바로 반영됩니다.

```yaml
registryModels:
  - id: classification
    title: Classification Model
    taskType: classification
    modelName: classification-best-model
    defaultStage: release
    defaultVersion: latest
    defaultDestinationDir: ./backend/artifacts/downloads
  - id: segmentation
    title: Segmentation Model
    taskType: segmentation
    modelName: segmentation-best-model
    defaultStage: release
    defaultVersion: latest
    defaultDestinationDir: ./backend/artifacts/downloads
```

주의:

- `modelName`은 FTP registry에 publish된 이름과 동일해야 합니다.
- `id`는 UI 식별자이므로 중복되면 안 됩니다.
- 변경 후 `YAML Catalog > Save & Apply`를 실행하세요.
