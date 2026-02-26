# Current 방식 vs Airflow 방식 분석

## TL;DR

- 지금 구조는 **UI에서 즉시 실험 실행/확인**하는 데 매우 빠르고 단순합니다.
- Airflow는 **정기 스케줄, 의존성 있는 다단계 파이프라인, 재시도/백필/운영 가시성**이 필요할 때 강합니다.
- 결론적으로 현재 단계에서는 **전면 전환보다 하이브리드(현행 유지 + 필요한 흐름만 Airflow)**가 가장 현실적입니다.

## 현재 방식(현행) 정리

현재 실행 흐름은 다음 성격을 가집니다.

- 트리거: 웹 UI/API에서 수동 실행 (`/api/runs/start`)
- 실행 엔진: 백엔드에서 Python subprocess 직접 실행
- 상태 저장: 프로세스 상태/로그를 앱 메모리에서 관리
- 관측: MLflow/TensorBoard + UI polling
- 설정 단일화: `backend/config/training_catalog.yaml` 중심

근거 코드/문서:

- 실행/상태 관리: `backend/app/services/run_manager.py`
- API 엔드포인트: `backend/app/api/routes.py`
- 설정 단일화 설명: `docs/architecture/ARCHITECTURE.md`

## Airflow 방식 정리

Airflow 기준으로 바꾸면 일반적으로 다음이 핵심입니다.

- DAG 기반 의존성 관리(전처리 → 학습 → 평가 → 등록/배포)
- 스케줄/캘린더 기반 자동 실행
- 실패 재시도, 백필(backfill), 실행 이력 영속화
- 운영용 모니터링/알림 연계(태스크 단위)
- 실행자(Local/Celery/Kubernetes)에 따른 수평 확장

## 비교표

| 항목 | 현재 방식 | Airflow 방식 |
| --- | --- | --- |
| 실행 시작 | UI/API 수동 트리거 중심 | 수동 + 스케줄 + 이벤트 확장 |
| 파이프라인 의존성 | 코드 내부 순차 처리 중심 | DAG로 명시적 의존성 관리 |
| 실패 처리 | 프로세스 실패 감지/중지 중심 | 태스크별 재시도/재실행/백필 |
| 상태 영속성 | 런 상태는 앱 프로세스 메모리 중심 | 메타DB에 실행 이력 영속화 |
| 운영 가시성 | 앱 UI + MLflow 중심 | DAG/Task 운영 UI + 로그 체계 |
| 확장성 | 단일 백엔드 프로세스 중심 | Executor 기반 확장 가능 |
| 온보딩 난이도 | 낮음 | 중간~높음 (Airflow 운영 지식 필요) |
| 운영 비용 | 낮음 | 중간~높음 (컴포넌트/장애 대응 증가) |

## “Airflow로 발전”이 필요한 조건

아래 조건이 2~3개 이상이면 도입 필요성이 높습니다.

1. 정기 재학습(예: 매일/매주) 자동화가 필요하다.
2. 전처리/검증/학습/평가/배포 승인 같은 다단계 의존성이 명확하다.
3. 실패 재시도, 지연 실행, 백필이 운영 요구사항이다.
4. 팀이 늘어나고 운영 책임 분리가 필요하다.
5. 단일 프로세스 기반 실행으로 병목/가시성 한계가 보인다.

반대로 아래에 가깝다면 현행 유지가 더 효율적입니다.

- 실험은 주로 수동 실행이고, 즉시 확인/반복이 중요함
- 파이프라인이 단순하며 운영 자동화 요구가 크지 않음
- 인프라 운영 부담을 늘리고 싶지 않음

## 추천 전략: 전면 전환 대신 하이브리드

### 1단계 (즉시 가능, 저위험)

- 현행 UI/API/`training_catalog.yaml` 구조 유지
- “배치성 높은 흐름”만 후보 선정:
  - 정기 retrain
  - nightly best-model publish
  - 주기적 품질 리포트 생성

### 2단계 (PoC)

- Airflow DAG 1~2개만 파일럿 적용
- DAG 내부에서 기존 실행 경로를 재사용:
  - 기존 Python entrypoint 또는 API 호출
  - MLflow/FTP 레지스트리 로직은 최대한 재사용

### 3단계 (확장 판단)

- PoC에서 다음 지표로 확대 여부 결정:
  - 수동 개입 시간 감소
  - 실패 복구 시간(MTTR) 개선
  - 야간/주기 작업 안정성

## 이 레포 기준 권장안

현재 구조는 실험 속도와 유연성이 강점이므로, 지금 즉시 “전체 Airflow 전환”은 비용 대비 이득이 작을 가능성이 큽니다.
다만 운영 배치가 늘어날 가능성이 높기 때문에, **Airflow를 보조 오케스트레이터로 병행 도입**하는 방향이 적합합니다.

즉, 결론은:

- 지금 당장 필수: **아님**
- 중기 확장 대비: **필요 가능성 높음**
- 실행 방식: **하이브리드로 단계 도입 권장**

## 추가 질문 업데이트 (현재 상태 기준)

### Q1) 지금 상태에서 진행상황은 어떤 식으로 보나?

현재는 Airflow Task UI가 아니라, 앱 자체 run manager + MLflow/TensorBoard를 함께 봅니다.

- 웹 UI `Live Runs`
  - `GET /api/runs`를 약 1.5초 간격으로 polling
  - 진행률 바: `progress.epoch / progress.total_epochs`
  - 최근 로그 tail, status(`running/completed/failed/stopped`), `mlflowRunId` 확인
- 단건 조회
  - `GET /api/runs/{run_id}`
- 실험 지표/아티팩트
  - `MLflow Ops`(약 3초 polling) 또는 MLflow UI에서 metric/artifact 확인
  - TensorBoard 이벤트 파일은 `tensorboard_dir`에 기록

주의:

- run 상태(`progress`, `logs`)는 백엔드 프로세스 메모리 기반이라 서버 재시작 시 휘발됩니다.

### Q2) 원리는 어떻게 동작하나?

핵심은 `training_catalog.yaml`을 실행 계약(single source of truth)으로 두고, run manager가 subprocess를 감시하는 구조입니다.

1. UI가 `POST /api/runs/start` 호출
2. `run_manager`가 catalog task를 로드하고 기본 필드 + `extraFields`를 병합/검증
3. 최종 CLI 인자를 만들어 trainer 스크립트(`runner.target`)를 subprocess로 실행
4. trainer stdout에서 아래 prefix 라인을 실시간 파싱
   - `VTM_PROGRESS::{"epoch":...}`
   - `VTM_RUN_META::{"mlflow_run_id":"..."}`
5. 파싱 결과를 run record(`progress`, `mlflowRunId`, `logs`)에 반영
6. 프론트 polling으로 `Live Runs`가 계속 갱신

### Q3) `train.py`에서 어떤 규약을 지켜야 하나?

샘플 trainer 대신 외부 `train.py`를 `runner.target`으로 연결할 때, 아래 규약을 맞추면 현재 UI/API와 바로 호환됩니다.

1. CLI 인자 규약
   - catalog의 `baseTaskType`에 해당하는 기본 인자를 파싱해야 함
   - `extraFields`를 정의했다면 그 CLI flag도 파싱해야 함
   - (`argparse` 사용 시 미정의 인자를 받으면 종료되므로 주의)
2. 진행률 출력 규약
   - stdout 한 줄에 `VTM_PROGRESS::` + JSON 출력
   - 최소 권장 키: `epoch`, `total_epochs`
   - 지표 키 예시: `val_accuracy` 또는 `val_iou` (UI metric 표시용)
3. run meta 출력 규약
   - stdout 한 줄에 `VTM_RUN_META::` + JSON 출력
   - `mlflow_run_id`를 포함하면 UI/MLflow 연계가 쉬움
4. flush/버퍼링 규약
   - line 단위 실시간 반영을 위해 `print(..., flush=True)` 권장
5. 종료 코드 규약
   - exit code `0`이면 `completed`, 그 외는 `failed`로 처리됨

예시:

```python
import json

print("VTM_RUN_META::" + json.dumps({"mlflow_run_id": run_id}), flush=True)
print(
    "VTM_PROGRESS::" + json.dumps(
        {"epoch": epoch, "total_epochs": epochs, "val_accuracy": val_acc, "device": "cuda:0"}
    ),
    flush=True,
)
```
