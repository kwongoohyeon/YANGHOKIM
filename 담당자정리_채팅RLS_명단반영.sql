-- ⛔⛔ 폐기됨 — 이 파일을 실행하지 말 것 (2026-09-11) ⛔⛔
--   이 파일의 individual 명단에는 **이만나미가 없다.** 지금 돌리면 2026-09-11 에 추가한
--   이만나미가 다시 빠져 **개인팀 채팅이 또 막힌다**(App.js 와 어긋나 "탭은 보이는데
--   메시지가 안 오는" 상태가 된다).
--   → 대체 파일: `이만나미_권한정리_채팅RLS_명단반영.sql`
--      (이 파일이 하려던 현애·인선·미현 제거 + 이만나미 추가를 **한꺼번에** 반영했다.
--       2026-09-11 실행 완료 · 검증 `이만나미_권한정리_검증.sql`)
--   이력 참고용으로만 남긴다.
-- ────────────────────────────────────────────────────────────────────────────
-- 💬 채팅 채널 접근 명단 — App.js 의 CHAT_TEAMS 와 한 쌍인 SQL 함수를 같은 명단으로 맞춘다.
--   원본: 채팅_DM_비공개_RLS.sql 의 public.chat_can_access()
--   2026-08-17: 현애·인선·미현 제거 (정원은 원래 양쪽에 있었음)
--   함수 본문만 교체하므로 정책(policy)·트리거는 손대지 않는다.
-- 실행: ⛔ 돌리지 말 것 (위 폐기 안내 참고)
begin;

create or replace function public.chat_can_access(p_channel text, p_me text)
returns boolean
language sql immutable
as $$
  select case
    when coalesce(p_me, '') = '' or coalesce(p_channel, '') = '' then false
    when p_channel = 'general'    then true
    when p_channel = 'corporate'  then p_me = any (array['양호','동일','유진','정원'])
    when p_channel = 'individual' then p_me = any (array['양호','동일','관호','지혜','정원'])
    when p_channel like 'dm:%'    then p_me = any (string_to_array(substr(p_channel, 4), '|'))
    else false
  end;
$$;

commit;

-- ✅ 검증 — 아래가 전부 기대값과 같아야 한다.
--    빠진 3명은 팀 채널 false, 남은 사람은 true.
select
  public.chat_can_access('corporate',  '현애') as 현애_법인,   -- false
  public.chat_can_access('individual', '현애') as 현애_개인,   -- false
  public.chat_can_access('corporate',  '인선') as 인선_법인,   -- false
  public.chat_can_access('corporate',  '미현') as 미현_법인,   -- false
  public.chat_can_access('corporate',  '정원') as 정원_법인,   -- true
  public.chat_can_access('individual', '정원') as 정원_개인,   -- true
  public.chat_can_access('individual', '지혜') as 지혜_개인,   -- true
  public.chat_can_access('corporate',  '유진') as 유진_법인,   -- true
  public.chat_can_access('general',    '현애') as 현애_전체;   -- true (전체 채널은 누구나)
