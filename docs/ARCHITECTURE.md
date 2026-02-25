# Architecture

## Backend (`backend/`)

- `config/training_catalog.yaml`
  - UI + backend 공용 task 카탈로그 단일 소스
  - task별 시작 방법, args/UI 필드 구성, MLflow 기본값 관리
- `app/core/task_catalog.py`
  - YAML 카탈로그 로드/검증
  - task 정의를 API 스키마/런타임 실행 설정으로 변환
- `app/core/train_config.py`
  - task별 dataclass 템플릿/타입 검증
  - CLI arg 변환/파싱 기본 기능
- `app/services/run_manager.py`
  - YAML 카탈로그 기준 subprocess 실행
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

- YAML 카탈로그 하나로 `학습 시작 방식`, `웹 폼`, `런타임 기본값`을 일원화
- dataclass는 타입 안정성을 위한 템플릿으로 유지하고, UI/실행 정책은 YAML에서 관리
- MLflow를 중심으로 하되 TensorBoard existing workflow를 끊지 않고 점진 전환 가능
- 모델 서빙은 MLflow 우선 + 운영 fallback(FTP/Local)까지 확보
