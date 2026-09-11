-- ============================================================================
-- 🔐 이만나미 profiles.role : 'admin' → 'member'  (2026-09-11, 사용자 결정)
--
-- [왜] 2026-08-27 가입 때 role 이 'admin' 으로 들어가 있었다. 그 결과 이 계정은
--   · 사이드바 **「팀원 관리」 메뉴**가 보이고 (App.js:8812 `profile.role === "admin"`)
--   · `p_profiles_update` / `p_profiles_delete` 정책이 `is_admin()` 이라
--     **다른 사람의 role·status 를 바꾸거나 프로필 행을 삭제**할 수 있었다
--   · `chat_is_admin()` 으로 자기가 볼 수 있는 채널에서 **남의 메시지를 삭제**할 수 있었다
--   개인전담 팀원에게 필요한 권한이 아니다 → 'member' 로 낮춘다.
--
-- ⚠️ 이 UPDATE 는 **관리자 컨텍스트에서만 먹는다** (CLAUDE.md 2-4).
--    `trg_protect_profile` → `protect_profile_privileges()` 가
--    `if not public.is_admin() then new.role := old.role; ... end if;` 라서,
--    그냥 돌리면 **에러 없이 조용히 원복된다**(커밋은 성공하는데 값은 그대로).
--    → 아래처럼 admin uuid 로 jwt claims 를 세우고 `set role authenticated` 로 감싼다.
--    쓰는 uuid = 정원(b73eb1b9…, role='admin' status='approved'). 이만나미 본인 uuid 를
--    쓰면 안 된다 — 이 UPDATE 가 성공하는 순간 그 세션의 is_admin() 근거가 사라진다.
--
-- ⚠️ 멱등하게 짰다 — `and role = 'admin'` 가드가 있어 두 번 돌려도 안전하고,
--    그 사이 사람이 이미 바꿨으면 조용히 0행 처리된다.
--
-- 실행:     node scripts/run-sql.js 이만나미_권한정리_role_member.sql
-- 검증:     node scripts/run-sql.js 이만나미_권한정리_검증.sql  (⚠ 별도 조회로 — CLAUDE.md 2-2)
-- 되돌리기: 이만나미_권한정리_role_member_rollback.sql
-- ============================================================================

begin;

set local request.jwt.claims = '{"sub":"b73eb1b9-14ac-4dd4-a1e0-2a2ae2f96009","role":"authenticated"}';
set local role authenticated;

update public.profiles
   set role = 'member'
 where id = '91e42a4b-9787-47f9-b3ca-3e49de6e0197'
   and name = '이만나미'
   and role = 'admin';

reset role;

commit;

-- 실행 직후 눈으로 보는 요약 (⚠ 판정은 이만나미_권한정리_검증.sql 로 따로 할 것)
select id, name, role, team, status
  from public.profiles
 where id = '91e42a4b-9787-47f9-b3ca-3e49de6e0197';
