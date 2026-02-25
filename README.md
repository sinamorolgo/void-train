# Void Train Manager

PyTorch 학습(분류/세그)을 웹 UI로 실행하고 MLflow 중심으로 추적/선택/서빙까지 연결하는 로컬 MLOps 도구입니다.

학습 런처 UI/백엔드는 `backend/config/training_catalog.yaml` 하나로 일원화되어 동작합니다.

## 빠른 시작

1. 백엔드 + MLflow 실행

```bash
uv venv .venv --python 3.11
uv sync --python .venv/bin/python --only-group backend --no-default-groups
./backend/scripts/start_mlflow_local.sh
```

새 터미널:

```bash
./backend/scripts/start_api.sh
```

2. 프론트 실행

```bash
cd frontend
pnpm install
pnpm dev
```

3. 접속

- UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8008/api/health`
- MLflow: `http://127.0.0.1:5001`

## 의존성 관리

- 기본: `uv sync --python .venv/bin/python --only-group backend --no-default-groups`
- pip fallback: `.venv/bin/python -m pip install -r backend/requirements.txt`
- requirements 동기화: `./backend/scripts/sync_requirements.sh`

## 런처 설정 일원화

- 단일 설정 파일: `backend/config/training_catalog.yaml`
- 경로 오버라이드: `.env`의 `TRAINING_CATALOG_PATH`
- `.env` 예시: `.env.example`
- 변경 가능한 항목:
  - UI에 노출할 task 목록/이름/설명
  - task별 시작 방식(`python_script` 또는 `python_module`)과 실행 타깃
  - task별 field 순서/숨김/기본값/라벨/설명
  - MLflow best metric/mode/modelName/artifactPath 기본값

## 문서

- [Setup](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [FTP Model Registry](./docs/FTP_MODEL_REGISTRY.md)
