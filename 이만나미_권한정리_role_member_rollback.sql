-- ============================================================================
-- ↩️ 되돌리기 — 이만나미 profiles.role : 'member' → 'admin'
--
-- ⚠️ 되돌리면 이 계정이 다시 **다른 사람의 role·status 를 바꾸고 프로필을 삭제할 수 있다**
--    (`p_profiles_update`/`p_profiles_delete` 가 `is_admin()`). 정말 필요한지 먼저 판단할 것.
--
-- ⚠️ 관리자 컨텍스트로 감싸야 먹는다(CLAUDE.md 2-4). 감싸지 않으면 조용히 원복된다.
--    이만나미는 이 시점에 member 라 본인 uuid 로는 못 돌린다 → 정원 uuid 를 쓴다.
--
-- 실행: node scripts/run-sql.js 이만나미_권한정리_role_member_rollback.sql
-- ============================================================================

begin;

set local request.jwt.claims = '{"sub":"b73eb1b9-14ac-4dd4-a1e0-2a2ae2f96009","role":"authenticated"}';
set local role authenticated;

update public.profiles
   set role = 'admin'
 where id = '91e42a4b-9787-47f9-b3ca-3e49de6e0197'
   and name = '이만나미'
   and role = 'member';

reset role;

commit;

select id, name, role, team, status
  from public.profiles
 where id = '91e42a4b-9787-47f9-b3ca-3e49de6e0197';
