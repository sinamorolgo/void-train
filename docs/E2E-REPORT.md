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

## 4) YAML Studio E2E (2026-02-26 추가 검증)

검증 항목:

- [x] `Filter tasks` 입력 시 `Showing n/m` 실시간 반영
- [x] `Collapse All` 실행 시 모든 task 카드가 실제로 collapsed 상태
- [x] `taskType` 중복 입력 시 즉시 Validation 경고 + Save 비활성화
- [x] `fieldOverrides` JSON 편집 중 parse/mismatch 경고 및 저장 차단
- [x] `fieldOverrides`를 valid JSON으로 blur 반영 시 경고 해제 + Save 가능
- [x] `extraFields` JSON 편집 중 parse/mismatch 경고 및 저장 차단
- [x] `extraFields`를 valid JSON으로 blur 반영 시 경고 해제 + Save 가능
- [x] 미저장 상태에서 탭 이동 시 confirm 다이얼로그 표시(취소/승인 모두 확인)
- [x] `Reset Draft` 후 `In Sync` 복귀

추가로 반영한 수정:

1. `Collapse All` 동작 정합성 수정

- 기존: index 0 fallback 때문에 첫 task가 접히지 않는 케이스 존재
- 수정: `Collapse All` 시 모든 index를 `false`로 명시 설정

2. `fieldOverrides` 저장 차단 오탐 수정

- 기존: 문자열 포맷(pretty vs minified)만 달라도 mismatch로 판단
- 수정: JSON 파싱 후 semantic 비교로 변경, blur 시 canonical pretty JSON으로 정규화

3. `extraFields` 편집/저장 동선 추가

- `Advanced Fields`에 `extraFields (JSON array)` 입력 영역 추가
- 파싱 오류/미반영 draft가 있으면 저장 차단
- blur 시 canonical pretty JSON으로 정규화

## 5) 외부 `train.py` + YAML 동적 인자 검증 (2026-02-26)

검증 항목:

- [x] `runner.target`에 외부 절대 경로 스크립트 지정 시 API 스키마 반영
- [x] `extraFields` 정의가 `/api/config-schemas` 필드에 노출
- [x] 런 시작 시 `extraFields` 값이 CLI 인자로 직렬화됨
- [x] 필수 `extraFields` 누락 시 서버에서 400 에러 처리

근거 테스트:

- `backend/tests/test_run_manager.py`
- `backend/tests/test_task_catalog.py`
- `backend/tests/test_catalog_studio_routes.py`

## 6) FTP 등록 신규 기능 검증 (2026-02-26)

검증 항목:

- [x] `/api/mlflow/experiments` 실험 목록 조회
- [x] `/api/ftp-registry/publish-best` 베스트 run 자동 선택 후 FTP 등록
- [x] `/api/ftp-registry/upload-local` 파일 업로드 기반 FTP 등록

근거 테스트:

- `backend/tests/test_registry_routes.py::test_get_mlflow_experiments`
- `backend/tests/test_registry_routes.py::test_publish_best_to_ftp_registry`
- `backend/tests/test_registry_routes.py::test_upload_local_to_ftp_registry`

## 7) 결론

요청하신 핵심 시나리오(학습 실행/모니터링, MLflow 전환, best 모델 선택, 다운로드, 로컬 및 MLflow 서빙)는 실제 실행으로 검증 완료했습니다.
