# YAML Studio Risk Analysis and Mitigation

`YAML Studio` 도입 후 운영 리스크를 점검하고 반영한 개선 사항입니다.

## Risk 1. Duplicate `taskType`로 인한 런타임 혼선

설명:

- 동일 `taskType`가 중복되면 런처 스키마/실행 타깃 매핑이 모호해질 수 있음

조치:

- 서버 유효성 검사에서 `taskType` 중복을 차단
- `save_catalog_studio`/`save_catalog` 모두 동일 검증 경로 사용

검증:

- `backend/tests/test_task_catalog.py::test_duplicate_task_type_raises`
- `backend/tests/test_catalog_studio_routes.py::test_save_catalog_studio_rejects_duplicate_task_type`

## Risk 2. `fieldOverrides` JSON 편집 중 저장 누락

설명:

- 사용자가 JSON을 수정했지만 blur 이전/파싱 실패 상태에서 저장하면 의도와 다른 값이 저장될 수 있음

조치:

- UI에서 `fieldOverrides` 파싱 오류 개수 표시
- 미반영 draft(편집 텍스트와 적용값 불일치) 존재 시 저장 버튼 비활성화
- blur 시 valid JSON을 canonical pretty JSON으로 정규화해 사용자가 반영 상태를 즉시 확인 가능하게 개선
- draft mismatch 판정을 문자열 비교가 아닌 JSON semantic 비교로 변경

검증:

- `CatalogStudioPanel` 저장 가능 조건: validation + parse error + draft mismatch 모두 통과해야 저장 가능

## Risk 3. 미저장 상태에서 탭 이동

설명:

- `YAML Studio` 편집 후 다른 탭 이동 시 변경 유실 위험

조치:

- `catalog`와 동일하게 `studio` 탭에도 unsaved 이동 경고 추가
- 브라우저 `beforeunload` 경고 대상에 studio dirty 상태 포함

## Risk 4. `Collapse All` 동작과 실제 카드 상태 불일치

설명:

- 기본 확장 fallback(index 0) 때문에 `Collapse All` 이후에도 첫 카드가 펼쳐진 채 남을 수 있음

조치:

- `Collapse All` 시 모든 task index를 명시적으로 `false`로 설정해 UI 상태를 deterministic하게 유지

검증:

- Playwright E2E에서 `Collapse All` 후 `Task #1`, `Task #2` 모두 `Expand` 버튼 상태 확인

## 운영 가이드

1. 저장 전 상단 배지에서 `Validation: Ready` 확인
2. `fieldOverrides` 경고가 있으면 먼저 해소
3. `Save 전에 백업 파일 생성` 옵션은 기본 활성 상태 유지 권장
