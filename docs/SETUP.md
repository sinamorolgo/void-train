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
uv pip install --python .venv/bin/python -r backend/requirements.txt

# MLflow tracking server (SQLite backend)
./backend/scripts/start_mlflow_local.sh

# 새 터미널에서 API 실행
./backend/scripts/start_api.sh
```

### PostgreSQL을 MLflow backend로 쓰고 싶다면 (옵션)

```bash
cd /Users/nok/workspace/void-train-manager
docker compose -f docker-compose.local-mlflow-postgres.yml up -d

uv pip install --python .venv/bin/python psycopg2-binary

.venv/bin/python -m mlflow server \
  --host 0.0.0.0 \
  --port 5001 \
  --backend-store-uri postgresql+psycopg2://mlflow:mlflow@127.0.0.1:55433/mlflow \
  --artifacts-destination ./backend/mlruns/artifacts
```

## 4) Frontend 실행

```bash
cd /Users/nok/workspace/void-train-manager/frontend
pnpm install
pnpm dev
```

접속: `http://127.0.0.1:5173`

## 5) TensorBoard → MLflow 빠른 전환

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

## 6) 기존 train.py 연결 방법

이미 운영 중인 `train.py` 2개(분류/세그)가 있다면 환경변수로 교체 가능합니다.

```bash
export CLASSIFICATION_SCRIPT_PATH=/abs/path/to/your/classification_train.py
export SEGMENTATION_SCRIPT_PATH=/abs/path/to/your/segmentation_train.py
```

권장 추가 사항:

1. UI/런처와 인자 일치를 위해 `backend/app/core/train_config.py`의 dataclass 필드명을 기준으로 CLI arg를 맞춥니다.
2. 실시간 진행률을 UI에 보내려면 stdout에 아래 prefix JSON 라인을 출력합니다.

```python
print("VTM_PROGRESS::" + json.dumps({"epoch": epoch, "total_epochs": epochs, "val_accuracy": val_acc}), flush=True)
```

3. MLflow run id를 UI에 연결하려면 아래 라인을 출력합니다.

```python
print("VTM_RUN_META::" + json.dumps({"mlflow_run_id": run.info.run_id}), flush=True)
```

## 7) 모델 서빙 전략

### 1순위: MLflow native serve

- UI의 `Model Serving -> MLflow Native Serve`
- 모델 URI 예: `models:/classification-best-model/1`

### 2순위: FTP fallback

- UI에서 FTP 정보 입력 → 모델 파일 다운로드
- `Local Loader`로 checkpoint 로드 후 `Local Predict` 사용

## 8) FTP 모델 레지스트리 (dev/release)

- MLflow run artifact를 `dev` 스테이지에 publish
- 검증 후 `release`로 promote
- 클라이언트는 FTP로 `LATEST` 파일 조회 후 버전 번들(`bundle.tar.gz`) 다운로드

자세한 내용은 [FTP_MODEL_REGISTRY.md](./FTP_MODEL_REGISTRY.md) 참고.

## 9) 체크리스트

- [ ] `http://127.0.0.1:5001` MLflow UI 접속 가능
- [ ] `http://127.0.0.1:8008/api/health` 응답 확인
- [ ] `http://127.0.0.1:5173` 프론트 접속 확인
- [ ] Launcher에서 학습 시작 후 Run 카드 진행률 갱신 확인
- [ ] MLflow Runs에 metric 축적 확인
