# Architecture

## Backend (`backend/`)

- `app/core/train_config.py`
  - 단일 소스 dataclass 정의 (공통 + task별)
  - API 스키마 자동 생성 + CLI arg 변환
- `app/services/run_manager.py`
  - subprocess로 학습 스크립트 실행
  - stdout의 `VTM_PROGRESS::` / `VTM_RUN_META::` 파싱
  - 실행 상태/로그/진행률 추적
- `app/services/mlflow_service.py`
  - MLflow run 조회, best run 선택, 모델 등록, artifact 다운로드
- `app/services/tb_migration.py`
  - TensorBoard 이벤트 스칼라를 MLflow metric으로 이관
- `app/services/ftp_model_registry.py`
  - FTP 배포 표준 구조(dev/release, LATEST, versions) 관리
  - MLflow/local source publish + stage promote + version resolve
- `app/services/ftp_server_manager.py`
  - 내장 FTP 서버(pyftpdlib) start/stop/list 제어
- `app/services/model_serving.py`
  - MLflow native serve 프로세스 제어
  - 로컬 checkpoint 로드/추론
- `app/services/ftp_service.py`
  - FTP 경유 모델 다운로드 fallback
- `app/api/routes.py`
  - UI에서 호출하는 REST API 전체

## Frontend (`frontend/`)

- `src/App.tsx`
  - React Query 기반 orchestration
  - API polling / mutation / notice 관리
- `src/components/LaunchPanel.tsx`
  - task 전환 + dataclass 스키마 기반 동적 폼
- `src/components/RunsPanel.tsx`
  - 런 진행률/로그/중지
- `src/components/MlflowPanel.tsx`
  - best model 선택/등록, TB→MLflow 이관
- `src/components/ServingPanel.tsx`
  - MLflow serve + FTP fallback + local load/predict

## Training Scripts

- `backend/trainers/train_classification.py`
- `backend/trainers/train_segmentation.py`

둘 다 다음을 공통으로 수행합니다.

- TensorBoard + MLflow 동시 로깅
- 체크포인트 저장
- 진행률 stdout 이벤트 출력 (`VTM_PROGRESS::...`)
- run meta 출력 (`VTM_RUN_META::...`)

## Why this structure

- dataclass 하나로 `CLI 인자`, `웹 폼`, `런타임 설정`을 일원화
- 분류/세그 인자 차이를 task-specific dataclass로 캡슐화
- MLflow를 중심으로 하되 TensorBoard existing workflow를 끊지 않고 점진 전환 가능
- 모델 서빙은 MLflow 우선 + 운영 fallback(FTP/Local)까지 확보
