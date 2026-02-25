# Void Train Manager

PyTorch 학습(분류/세그)을 웹 UI로 실행하고 MLflow 중심으로 추적/선택/서빙까지 연결하는 로컬 MLOps 도구입니다.

## 빠른 시작

1. 백엔드 + MLflow 실행

```bash
uv venv .venv --python 3.11
uv pip install --python .venv/bin/python -r backend/requirements.txt
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

## 문서

- [Setup](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [FTP Model Registry](./docs/FTP_MODEL_REGISTRY.md)
