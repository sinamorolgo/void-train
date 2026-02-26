# DB Schema Snapshot

> 아직 이 워크트리에 `.env`(DB 접속 정보)가 없어 실스키마 스냅샷을 생성하지 못했습니다.
> 아래 명령으로 즉시 갱신해서 사용하세요.

```bash
.venv/bin/python skills/schema-introspection-guard/scripts/refresh_schema_snapshot.py
```

생성 후 이 파일에 `information_schema.columns` 기반 전체 테이블/컬럼 목록이 저장됩니다.
