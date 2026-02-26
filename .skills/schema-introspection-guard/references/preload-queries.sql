-- 1) Non-system schemas
select schema_name
from information_schema.schemata
where schema_name not in ('pg_catalog', 'information_schema')
order by schema_name;

-- 2) Non-system base tables
select table_schema, table_name
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
  and table_type = 'BASE TABLE'
order by table_schema, table_name;

-- 3) Full column dictionary (핵심)
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema
 and t.table_name = c.table_name
where c.table_schema not in ('pg_catalog', 'information_schema')
  and t.table_type = 'BASE TABLE'
order by c.table_schema, c.table_name, c.ordinal_position;

-- 4) Query-safe existence check before ad-hoc SQL
-- replace :schema_name and :table_name
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = :schema_name
  and table_name = :table_name
order by ordinal_position;
