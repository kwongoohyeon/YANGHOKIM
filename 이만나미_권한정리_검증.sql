-- ============================================================================
-- ✅ 이만나미 권한정리 검증 (2026-09-11)
--   ⚠️ CLAUDE.md 2-2: 조치 파일에 딸린 SELECT 를 믿지 말고 **이 파일로 따로** 확인한다.
--   ⚠️ run-sql.js 는 결과를 하나만 찍는다 → SELECT 를 하나로 합쳐 두었다. 쪼개지 말 것.
--
--   전 구간을 **이만나미 본인 권한**(authenticated + 본인 uid)으로 돌린다 →
--   RLS 가 실제로 적용된 상태에서 "그 사람 화면에 무엇이 오는지"를 본다.
--
-- 실행: node scripts/run-sql.js 이만나미_권한정리_검증.sql
--
-- [기대값]
--   profile_role            = "member"       (admin 에서 낮춤)
--   profile_status          = "approved"
--   is_admin_본인           = false          (팀원 관리 메뉴가 사라지는 근거)
--   chat_개인 / chat_전체    = true           (증상 1·2 해소)
--   chat_법인               = false          (개인전담이므로 정상)
--   퇴사자_개인 / 퇴사자_법인 = false          (현애·인선·미현 전부)
--   함수에_이만나미_있음      = true
--   함수에_퇴사자_남음        = false          (SQL 명단 청소 확인)
--   보이는_채팅채널           = ["general","individual"] 만
--   정산_보이는행 = 정산_이만나미담당           (본인 담당 건만 보인다 = 전체열람 아님)
-- ============================================================================

set local request.jwt.claims = '{"sub":"91e42a4b-9787-47f9-b3ca-3e49de6e0197","role":"authenticated"}';
set local role authenticated;

select json_build_object(
  -- ① profiles 실제 값
  'profile_role',            (select role   from public.profiles where id = auth.uid()),
  'profile_status',          (select status from public.profiles where id = auth.uid()),
  'profile_team',            (select team   from public.profiles where id = auth.uid()),
  'profile_name',            (select name   from public.profiles where id = auth.uid()),
  'is_admin_본인',            public.is_admin(),
  'is_approved_본인',         public.is_approved(),
  'wn_my_name',              public.wn_my_name(),

  -- ② 채널 판정 (함수에 이름을 직접 넣어 확인)
  'chat_개인',                public.chat_can_access('individual', '이만나미'),
  'chat_전체',                public.chat_can_access('general',    '이만나미'),
  'chat_법인',                public.chat_can_access('corporate',  '이만나미'),
  'chat_DM',                  public.chat_can_access('dm:이만나미|양호', '이만나미'),
  '퇴사자_개인',              json_build_object(
                                '현애', public.chat_can_access('individual','현애'),
                                '인선', public.chat_can_access('individual','인선'),
                                '미현', public.chat_can_access('individual','미현')),
  '퇴사자_법인',              json_build_object(
                                '현애', public.chat_can_access('corporate','현애'),
                                '인선', public.chat_can_access('corporate','인선'),
                                '미현', public.chat_can_access('corporate','미현')),

  -- ③ 함수 본문 자체를 문자열로 검사 (명단이 실제로 교체됐는지)
  '함수에_이만나미_있음',      (select pg_get_functiondef(p.oid) like '%이만나미%'
                                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname='public' and p.proname='chat_can_access'),
  '함수에_퇴사자_남음',        (select pg_get_functiondef(p.oid) ~ '(현애|인선|미현)'
                                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname='public' and p.proname='chat_can_access'),

  -- ④ RLS 를 실제로 통과해서 보이는 것 (이게 진짜 판정이다)
  '보이는_채팅채널',          (select json_agg(json_build_object('channel', channel, 'cnt', cnt)
                                                order by channel)
                                 from (select channel, count(*) as cnt
                                         from public.chat_messages
                                        where deleted_at is null
                                        group by channel) t),
  '정산_보이는행',            (select count(*) from public.settlement_manual where deleted_at is null),
  '정산_이만나미담당',         (select count(*) from public.settlement_manual
                                where deleted_at is null and assignee ilike '%이만나미%')
) as 검증결과;
