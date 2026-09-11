-- ============================================================================
-- ↩️ 되돌리기 — chat_can_access() 를 2026-09-11 변경 **이전 상태**로 복구한다.
--   즉 채팅_DM_비공개_RLS.sql(2026-08-10) 당시의 옛 명단으로 돌아간다:
--     corporate  = 양호·동일·유진·인선·미현·정원
--     individual = 양호·동일·관호·현애·지혜·정원
--
-- ⚠️ 이 롤백을 돌리면 **이만나미의 개인팀 채팅이 다시 막히고**, 퇴사자 3명(현애·인선·미현)이
--    DB 상으로는 팀 채널에 다시 접근 가능해진다(화면 App.js 에는 안 보이는 상태).
--    App.js `CHAT_TEAMS` 도 같이 되돌려야 짝이 맞는다 — 한쪽만 되돌리면 어긋난다.
--
-- 실행: node scripts/run-sql.js 이만나미_권한정리_채팅RLS_명단반영_rollback.sql
-- ============================================================================

begin;

create or replace function public.chat_can_access(p_channel text, p_me text)
returns boolean
language sql immutable
as $$
  select case
    when coalesce(p_me, '') = '' or coalesce(p_channel, '') = '' then false
    when p_channel = 'general'    then true
    when p_channel = 'corporate'  then p_me = any (array['양호','동일','유진','인선','미현','정원'])
    when p_channel = 'individual' then p_me = any (array['양호','동일','관호','현애','지혜','정원'])
    when p_channel like 'dm:%'    then p_me = any (string_to_array(substr(p_channel, 4), '|'))
    else false
  end;
$$;

commit;

select
  public.chat_can_access('individual', '이만나미') as 이만나미_개인,  -- false (되돌아감)
  public.chat_can_access('individual', '현애')     as 현애_개인;      -- true  (되돌아감)
