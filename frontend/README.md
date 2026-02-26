# Void Train Manager Frontend

React + TypeScript + Vite 기반의 운영 UI입니다.

## 주요 기능

- `Operations` 탭
  - 분류/세그 학습 시작
  - 실행 상태/로그/진행률 확인
  - MLflow best model 선택/등록
- `YAML Catalog` 탭
  - `training_catalog.yaml` 검증/포맷/저장
- `YAML Studio` 탭
  - task/registry 폼 편집
  - `fieldOverrides` + `extraFields` 고급 JSON 편집

## 개발 실행

```bash
pnpm install
pnpm dev
```

기본 주소: `http://127.0.0.1:5173`

API URL은 `VITE_API_BASE_URL`로 변경 가능합니다.

```bash
VITE_API_BASE_URL=http://127.0.0.1:8008/api pnpm dev
```

## 품질 점검

```bash
pnpm lint
pnpm build
```
