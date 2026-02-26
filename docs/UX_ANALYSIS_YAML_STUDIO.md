# YAML Studio UX Analysis (Before/After)

`YAML Studio` 전용 탭 추가 후 실제 화면 기준으로 UX를 점검하고, 1차 개선을 반영한 기록입니다.

## Capture 기준

- 캡처 도구: Playwright CLI (`$PWCLI`)
- 화면: `http://127.0.0.1:5173/?tab=studio`

## Before

![YAML Studio Before (Top)](./assets/studio-ux/studio-before-top.png)
![YAML Studio Before (Bottom)](./assets/studio-ux/studio-before-bottom.png)

관찰 이슈:

1. task 카드가 모두 펼쳐져 있어 스크롤이 길고 집중 포인트가 분산됨
2. 특정 task를 빠르게 찾는 검색/필터가 없어 편집 시간이 길어짐
3. Registry 표의 핵심 컬럼(`modelName`, `destination`)이 좁아 값이 잘림

## 개선 내용

1. task 카드 `Expand/Collapse` + `Expand All/Collapse All` 추가
2. `Filter tasks` 입력으로 taskType/title/baseTaskType 빠른 필터 추가
3. Registry 표 컬럼 최소 너비 조정(`modelName`, `destination`)으로 가독성 개선

## After

![YAML Studio After (Top)](./assets/studio-ux/studio-after-top.png)
![YAML Studio After (Bottom)](./assets/studio-ux/studio-after-bottom.png)

개선 결과:

- 대량 task 편집 시 인지 부하 감소
- 원하는 task로 이동 시간이 단축
- Registry 핵심 값 확인성 개선

## 다음 리스크 점검 포인트

1. 저장 전 데이터 무결성(중복/필수값/JSON 파싱 오류) 방어 강화
2. 저장 후 스키마 반영 상태를 더 명확히 피드백
3. 실수로 탭 이동 시 미저장 변경 유실 방지 동선 강화
