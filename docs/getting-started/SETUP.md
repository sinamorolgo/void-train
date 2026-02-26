# Void Train Manager Setup

## 1) 목표

이 프로젝트는 다음을 한 번에 제공합니다.

- 분류/세그 학습 실행 UI (React)
- 학습 진행률 추적 (실시간 poll)
- TensorBoard + MLflow 동시 로깅
- TensorBoard 로그를 MLflow로 이관하는 빠른 마이그레이션 유틸
- 베스트 metric 기반 MLflow 모델 선택/등록
- 모델 서빙: MLflow native serve 우선 + FTP fallback 다운로드 + 로컬 로더

## 2) 포트 정책 (중요)

SSH 터널링으로 이미 떠 있는 DB/Redis 포트는 건드리지 않습니다.

- Frontend: `5173`
- Backend API: `8008`
- MLflow Tracking: `5001`
- Optional local PostgreSQL for MLflow backend: `55433` (기존 5432와 분리)

## 3) Python Backend 실행

```bash
cd /Users/nok/workspace/void-train-manager
uv venv .venv --python 3.11
uv sync --python .venv/bin/python --only-group backend --no-default-groups

# MLflow tracking server (SQLite backend)
./backend/scripts/start_mlflow_local.sh

# 새 터미널에서 API 실행
./backend/scripts/start_api.sh
```

### PostgreSQL을 MLflow backend로 쓰고 싶다면 (옵션)

```bash
cd /Users/nok/workspace/void-train-manager
docker compose -f docker-compose.local-mlflow-postgres.yml up -d

uv sync --python .venv/bin/python --group backend --group postgres-mlflow --no-default-groups

.venv/bin/python -m mlflow server \
  --host 0.0.0.0 \
  --port 5001 \
  --backend-store-uri postgresql+psycopg2://mlflow:mlflow@127.0.0.1:55433/mlflow \
  --artifacts-destination ./backend/mlruns/artifacts
```

### pip fallback 설치 (requirements 기반)

`uv` 대신 `pip`로도 동일한 의존성 설치가 가능합니다.

```bash
cd /Users/nok/workspace/void-train-manager
python3 -m venv .venv
.venv/bin/python -m pip install -U pip
.venv/bin/python -m pip install -r backend/requirements.txt
```

PostgreSQL backend까지 함께 쓰려면:

```bash
.venv/bin/python -m pip install -r backend/requirements-postgres-mlflow.txt
```

requirements 파일은 아래 명령으로 `pyproject.toml`/`uv.lock` 기준 재생성합니다.

```bash
./backend/scripts/sync_requirements.sh
```

## 4) Frontend 실행

```bash
cd /Users/nok/workspace/void-train-manager/frontend
pnpm install
pnpm dev
```

접속: `http://127.0.0.1:5173`

실제 UI 캡처 기반 사용 예시는 [WEB_USAGE_GUIDE.md](../guides/WEB_USAGE_GUIDE.md) 참고.

## 5) YAML 기반 런처 일원화 설정

UI와 백엔드는 아래 파일을 단일 소스로 사용합니다.

- `backend/config/training_catalog.yaml`

`.env`에서 경로만 바꿔서 다른 설정 파일로 교체할 수 있습니다.

```bash
cp .env.example .env
# 필요 시 수정
TRAINING_CATALOG_PATH=./backend/config/training_catalog.yaml
```

카탈로그에서 조정 가능한 항목:

- task 노출/이름/설명 (`taskType`, `title`, `description`, `enabled`)
- 시작 방법/타깃 (`runner.startMethod`, `runner.target`, `runner.targetEnvVar`)
- UI 폼/args 구성 (`fieldOrder`, `hiddenFields`, `fieldOverrides`, `extraFields`)
- MLflow 기본값 (`mlflow.metric`, `mlflow.mode`, `mlflow.modelName`, `mlflow.artifactPath`)
- 모델 브라우저 노출/기본값 (`registryModels`)

`registryModels` 예시:

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

## 6) TensorBoard → MLflow 빠른 전환

### A. 기존 코드 유지 + 동시 로깅

현재처럼 TensorBoard를 계속 찍되, 학습 루프에서 MLflow metric logging만 추가하면 가장 빠릅니다.

핵심 패턴:

```python
writer.add_scalar("val/accuracy", val_acc, epoch)
mlflow.log_metric("val_accuracy", val_acc, step=epoch)
```

### B. 기존 TensorBoard 이벤트를 MLflow로 이관

```bash
cd /Users/nok/workspace/void-train-manager

.venv/bin/python -m backend.scripts.import_tensorboard_to_mlflow \
  --tensorboard-dir ./outputs/tensorboard \
  --tracking-uri http://127.0.0.1:5001 \
  --experiment-name void-train-manager \
  --run-name tb-import-20260225
```

또는 UI의 `MLflow Ops -> TensorBoard -> MLflow` 카드에서 바로 실행할 수 있습니다.

## 7) 기존 train.py 연결 방법

이미 운영 중인 `train.py`를 쓰려면 카탈로그 + 환경변수 조합으로 교체합니다.

```bash
export CLASSIFICATION_SCRIPT_PATH=/abs/path/to/your/classification_train.py
export SEGMENTATION_SCRIPT_PATH=/abs/path/to/your/segmentation_train.py
```

권장 추가 사항:

1. 외부 스크립트 전용 인자는 `extraFields`로 선언하면 UI 폼 + 런타임 CLI가 자동 동기화됩니다.

```yaml
tasks:
  - taskType: classification
    baseTaskType: classification
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
      - name: dry_run
        valueType: bool
        type: boolean
        default: false
```

2. 외부 스크립트가 내부 기본 인자를 받지 않는 경우 `hiddenFields`/`fieldOrder`로 UI 노출을 정리하고, 스크립트에서는 필요한 인자만 파싱하도록 맞춥니다.
3. 실시간 진행률을 UI에 보내려면 stdout에 아래 prefix JSON 라인을 출력합니다.

```python
print("VTM_PROGRESS::" + json.dumps({"epoch": epoch, "total_epochs": epochs, "val_accuracy": val_acc}), flush=True)
```

4. MLflow run id를 UI에 연결하려면 아래 라인을 출력합니다.

```python
print("VTM_RUN_META::" + json.dumps({"mlflow_run_id": run.info.run_id}), flush=True)
```

## 8) 모델 서빙 전략

### 1순위: MLflow native serve

- UI의 `Model Serving -> MLflow Native Serve`
- 모델 URI 예: `models:/classification-best-model/1`

### 2순위: FTP fallback

- UI에서 FTP 정보 입력 → 모델 파일 다운로드
- UI의 `Register .pth/.pt to FTP` 카드에서 로컬 `.pth/.pt`를 바로 publish 가능
- UI의 `Upload .pth/.pt and Register` 카드에서 브라우저 파일 업로드 후 바로 publish 가능
- UI의 `Publish Best Run to FTP` 카드에서 MLflow 베스트 run 자동 선택 후 publish 가능
- UI의 `Model Registry Browser` 카드에서 모델별(dev/release stage, version) 목록 확인 + 선택 다운로드
- `Convert to Torch Standard` 체크 시 `model-standard.pt` 생성/등록
- `Local Loader`로 checkpoint 로드 후 `Local Predict` 사용

### MLflow 베스트 자동 publish API

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-registry/publish-best \
  -H 'Content-Type: application/json' \
  -d '{
    "taskType":"classification",
    "stage":"dev",
    "experimentName":"void-train-manager",
    "metric":"val_accuracy",
    "mode":"max",
    "modelName":"classification-best-model",
    "artifactPath":"model",
    "setLatest":true
  }'
```

### 파일 업로드 publish API

```bash
curl -X POST http://127.0.0.1:8008/api/ftp-registry/upload-local \
  -F file=@./outputs/checkpoints/best_checkpoint.pth \
  -F modelName=classification-best-model \
  -F stage=dev \
  -F setLatest=true \
  -F convertToTorchStandard=true \
  -F torchTaskType=classification \
  -F torchNumClasses=5
```

## 9) FTP 모델 레지스트리 (dev/release)

- MLflow run artifact를 `dev` 스테이지에 publish
- 검증 후 `release`로 promote
- 클라이언트는 FTP로 `LATEST` 파일 조회 후 버전 번들(`bundle.tar.gz`) 다운로드

자세한 내용은 [FTP_MODEL_REGISTRY.md](../operations/FTP_MODEL_REGISTRY.md) 참고.

## 10) 체크리스트

- [ ] `http://127.0.0.1:5001` MLflow UI 접속 가능
- [ ] `http://127.0.0.1:8008/api/health` 응답 확인
- [ ] `http://127.0.0.1:5173` 프론트 접속 확인
- [ ] Launcher에서 학습 시작 후 Run 카드 진행률 갱신 확인
- [ ] MLflow Runs에 metric 축적 확인
