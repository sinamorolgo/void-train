# E2E Verification Report (2026-02-26)

환경:

- OS: macOS
- Backend: `uv` venv (`.venv`)
- Frontend: Vite React (`pnpm dev`)
- MLflow: local tracking server (`http://127.0.0.1:5001`)

## 1) UI E2E (Playwright MCP)

검증 항목:

- [x] React UI 로드 (`http://127.0.0.1:5173`)
- [x] Classification 학습 시작/완료 표시
- [x] Segmentation 학습 시작/완료 표시
- [x] Run progress, metric, device, MLflow run id 렌더링
- [x] MLflow Best Picker 실행 (segmentation)
- [x] TensorBoard -> MLflow import 버튼 동작
- [x] Local Loader + Local Predict UI 동작

브라우저에서 확인한 예시 결과:

- Segmentation best 등록 성공:
  - runId: `9f9ada5a0c474b9f89efe67e4567eb6c`
  - model: `segmentation-best-model` version `1`
- TensorBoard import 성공:
  - runId: `35fd331b6faf4cfd97084b2440c2a70b`
  - metricCount: `12`
- Local predict 성공:
  - predictions: `[4]`

## 2) API Integration E2E

검증 항목:

- [x] `/api/runs/start` 실행 + 완료
- [x] `/api/mlflow/select-best` (classification/segmentation)
- [x] `/api/models/download` (MLflow artifact)
- [x] `/api/serving/local/load`
- [x] `/api/serving/local/predict`
- [x] `/api/serving/mlflow/start` + `/ping` + `/stop`

예시 성공 결과:

- classification best 등록:
  - runId: `5e0079822b2040bebc3ea3ab55969e65`
  - model: `classification-best-model` version `3`
- MLflow native serving:
  - model URI: `models:/classification-best-model/3`
  - ping: HTTP `200`
  - invocations: 정상 응답 (`predictions` 반환)

## 3) 발견된 이슈와 반영한 수정

1. `select-best` 필터 문법 오류

- 원인: MLflow 검색 필터에 `IS NOT NULL` 사용
- 조치: server-side에서 metric 존재 여부를 후처리로 변경

2. MLflow native serve 시 `ModuleNotFoundError: trainers`

- 원인: 서빙 프로세스 PYTHONPATH에 프로젝트 모듈 경로 부재
- 조치: API의 mlflow serve subprocess에 `PYTHONPATH=<backend_root>` 주입

3. MLflow serve inference 시 dtype 충돌 (`double` vs `float`)

- 원인: JSON 입력이 float64로 해석됨
- 조치: 모델 `forward`에서 `x.float()` 강제 캐스팅

## 4) 결론

요청하신 핵심 시나리오(학습 실행/모니터링, MLflow 전환, best 모델 선택, 다운로드, 로컬 및 MLflow 서빙)는 실제 실행으로 검증 완료했습니다.
