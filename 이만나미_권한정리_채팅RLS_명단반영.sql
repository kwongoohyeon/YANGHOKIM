-- ============================================================================
-- 💬 채팅 채널 접근 명단 — App.js `CHAT_TEAMS` 와 한 쌍인 SQL 함수를 같은 명단으로 맞춘다.
--   원본: 채팅_DM_비공개_RLS.sql 의 public.chat_can_access()
--
-- [이 파일이 하는 일] 2026-09-11
--   ① 개인팀에 **이만나미** 추가 (2026-08-27 가입. 명단에 없어서 개인팀 채널이 아예 안 보였다)
--   ② 2026-08-17 에 App.js 에서만 빠지고 **SQL 에는 남아 있던 현애·인선·미현 제거**
--      (CLAUDE.md 🚧 보류 중 항목 — `담당자정리_채팅RLS_명단반영.sql` 이 하려던 일)
--      → 이 파일이 그 보류 파일을 **대체한다.** 그쪽은 이만나미가 빠져 있어 그대로 쓰면 안 된다.
--
-- [최종 명단 — App.js:CHAT_TEAMS 와 글자 단위로 같아야 한다]
--   corporate  = 양호 · 동일 · 유진 · 정원
--   individual = 양호 · 동일 · 관호 · 지혜 · 정원 · 이만나미
--   ⚠ 한쪽만 고치면 "화면엔 채널이 있는데 DB 가 메시지를 안 준다"(또는 그 반대)가 된다.
--     일치 여부는 `node scripts/test-imannami-access.mjs` 가 두 파일을 직접 읽어 검사한다.
--   ⚠ 팀 목록의 원본은 `profiles.team` 이 아니라 이 명단이다(App.js 하드코딩 배열이 정본).
--
-- 함수 본문만 교체한다 — 정책(policy)·트리거는 손대지 않는다.
-- 실행:     node scripts/run-sql.js 이만나미_권한정리_채팅RLS_명단반영.sql
-- 검증:     node scripts/run-sql.js 이만나미_권한정리_검증.sql   (⚠ 별도 조회로 — CLAUDE.md 2-2)
-- 되돌리기: 이만나미_권한정리_채팅RLS_명단반영_rollback.sql
-- ============================================================================

begin;

create or replace function public.chat_can_access(p_channel text, p_me text)
returns boolean
language sql immutable
as $$
  select case
    when coalesce(p_me, '') = '' or coalesce(p_channel, '') = '' then false
    when p_channel = 'general'    then true
    when p_channel = 'corporate'  then p_me = any (array['양호','동일','유진','정원'])
    when p_channel = 'individual' then p_me = any (array['양호','동일','관호','지혜','정원','이만나미'])
    when p_channel like 'dm:%'    then p_me = any (string_to_array(substr(p_channel, 4), '|'))
    else false
  end;
$$;

commit;

-- 실행 직후 눈으로 보는 요약 (⚠ 판정은 이만나미_권한정리_검증.sql 로 따로 할 것)
select
  public.chat_can_access('individual', '이만나미') as 이만나미_개인,  -- true  (이번에 추가)
  public.chat_can_access('general',    '이만나미') as 이만나미_전체,  -- true  (전체는 원래 전원)
  public.chat_can_access('corporate',  '이만나미') as 이만나미_법인,  -- false (개인전담이므로)
  public.chat_can_access('individual', '현애')     as 현애_개인,      -- false (이번에 제거)
  public.chat_can_access('corporate',  '인선')     as 인선_법인,      -- false (이번에 제거)
  public.chat_can_access('corporate',  '미현')     as 미현_법인;      -- false (이번에 제거)
