# Query Playbook (Schema Mismatch 방지)

## 1) 시작 전 스냅샷 확인
- `schema-snapshot.md`에서 테이블/컬럼 존재 여부를 먼저 확인한다.
- 이름이 다르거나 확신이 없으면 `information_schema.columns`로 즉시 재검증한다.

## 2) 안전한 조회 패턴
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'chatbot'
  and table_name = 'rooms'
order by ordinal_position;
```

```sql
select *
from chatbot.rooms
order by updated_at desc
limit 20;
```

## 3) 트랜잭션 에러 연쇄 차단
- psycopg2에서 하나의 쿼리가 실패하면 같은 커넥션에서 이후 쿼리가 모두 실패할 수 있다.
- 쿼리 실패 시 반드시 `rollback` 후 재시도한다.

Python 패턴:
```python
try:
    cur.execute(sql, params)
except Exception:
    conn.rollback()
    raise
```

## 4) 조회 스크립트 기본 규칙
- `.venv/bin/python`만 사용한다.
- 호스트는 `127.0.0.1` 또는 `.env` 값으로 고정한다.
- 스키마 prefix를 항상 붙인다.
