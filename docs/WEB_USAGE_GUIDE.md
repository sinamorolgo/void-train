# Web Usage Guide (Captured UI)

`Void Train Manager`의 실제 웹 화면 기준 사용 가이드입니다.

## 1) Operations 화면

학습 실행/진행 확인/MLflow 작업을 한 화면에서 처리합니다.

![Operations Overview](./assets/web-usage/web-operations-overview.png)

핵심:

- `Run Launcher`: 분류/세그 학습 시작
- `Live Runs`: 실행 상태/로그 확인
- `MLflow Ops`: best run 선택, TensorBoard -> MLflow 이관

## 2) YAML Catalog 화면

코드 수정 없이 `training_catalog.yaml`을 검증/저장해 UI와 런타임을 동기화합니다.

![YAML Catalog](./assets/web-usage/web-yaml-catalog.png)

권장 순서:

1. `Validate YAML`
2. `Format YAML`
3. `Save & Apply`

## 3) Model Registry Browser (모델별 stage/version 조회 + 다운로드)

`Model Serving` 하단에서 `registryModels` 기준 모델 목록을 보고 다운로드합니다.

![Model Registry Browser](./assets/web-usage/web-model-registry-browser.png)

다운로드 절차:

1. `Selected Model` 선택 (예: Classification / Segmentation)
2. `Stage` 선택 (`dev` 또는 `release`)
3. `Version` 선택 (`latest` 또는 특정 버전)
4. `Artifact` 선택 (`bundle.tar.gz`, `manifest.json`, `model-standard.pt`)
5. `Destination` 지정 후 `Download Selected Artifact`

## 4) 모델 추가/수정 (YAML 단일 관리)

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
