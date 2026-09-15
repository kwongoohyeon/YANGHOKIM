-- 📢 announcements 되돌리기
--   ⚠️ 테이블을 통째로 지운다. 저장된 공고가 있으면 같이 사라진다.
--      실행 전에 남은 행이 있는지 반드시 확인할 것:
--        select count(*) from public.announcements where deleted_at is null;
--   실행: node scripts/run-sql.js 공고매칭_announcements_테이블추가_rollback.sql
begin;
drop policy if exists p_announcements_select on public.announcements;
drop policy if exists p_announcements_insert on public.announcements;
drop policy if exists p_announcements_update on public.announcements;
drop policy if exists p_announcements_delete on public.announcements;
drop table if exists public.announcements;
commit;
