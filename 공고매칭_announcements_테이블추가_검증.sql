-- 📢 announcements 검증 — 조치 파일과 **따로** 실행할 것
--    (run-sql.js 는 마지막 SELECT 하나만 출력한다. CLAUDE.md 2-2)
--    실행: node scripts/run-sql.js 공고매칭_announcements_테이블추가_검증.sql
--    기대: 아래 7칸이 전부 true / anon_grants = 0 / extra_grants = 0
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='announcements') = 1            as 테이블존재,
  (select relrowsecurity from pg_class
    where relnamespace='public'::regnamespace and relname='announcements')     as rls켜짐,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='announcements') = 4               as 정책4개,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='announcements'
      and (roles::text like '%anon%' or roles::text like '%public%')) = 0       as anon정책없음,
  (select count(*) from information_schema.role_table_grants
    where table_schema='public' and table_name='announcements'
      and grantee='anon')                                                       as anon_grants,
  (select count(*) from information_schema.role_table_grants
    where table_schema='public' and table_name='announcements'
      and grantee='authenticated'
      and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))                as extra_grants,
  (select count(*) from pg_indexes
    where schemaname='public' and tablename='announcements'
      and indexname='announcements_source_external_uniq') = 1                   as unique인덱스;
