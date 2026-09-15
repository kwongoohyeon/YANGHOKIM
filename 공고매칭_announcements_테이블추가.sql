-- ============================================================================
-- 📢 공고 매칭 — announcements 테이블 · RLS · 권한
--   설계: docs/superpowers/specs/2026-08-30-공고매칭-design.md §5
--   실행:     node scripts/run-sql.js 공고매칭_announcements_테이블추가.sql
--   검증:     node scripts/run-sql.js 공고매칭_announcements_테이블추가_검증.sql  ← 반드시 따로
--   되돌리기: 공고매칭_announcements_테이블추가_rollback.sql
--   프로젝트: ujdrjvnihxjvbkezjvwc
--
-- [왜 테이블이 하나뿐인가]
--   기관 디렉토리(support_agencies)는 이번 범위에서 빠졌다(2026-08-30 결정).
--   가리킬 테이블이 없는 source_agency_id 는 죽은 컬럼이 되므로 넣지 않는다.
--   나중에 그 기능을 할 때 `add column if not exists source_agency_id uuid` 한 줄로 붙는다.
--
-- [⚠️ match_summary / match_rows 를 나누는 이유]
--   목록 화면은 match_summary 만 select 한다. 자동 수집이 켜져 공고가 수백 건이 되면
--   둘을 같이 부르는 순간 목록 한 번에 수 MB 가 오간다.
--
-- [⚠️ unique 인덱스에 `where deleted_at is null` 을 넣지 않는 이유]
--   파이프라인 카드 휴지통과 같은 규칙이다. 사람이 "관심 없음"으로 지운 공고가
--   다음 자동 수집 때 되살아나면 안 된다. 수집기는 삭제분까지 보고 건너뛴다.
--
-- ⚠️ team_notes.is_announcement(팀 공지)와 아무 관계가 없다. 이름이 비슷할 뿐이다.
-- ============================================================================

begin;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),

  -- 출처 (자동수집 확장의 이음매)
  source       text not null default 'manual',
  external_id  text,
  external_url text,

  -- 내용
  title           text not null,
  agency          text,
  support_summary text,
  apply_start     date,
  apply_end       date,

  -- 조건
  conditions       jsonb,   -- 확정본. 매칭이 보는 유일한 값
  conditions_ai    jsonb,   -- AI 추출 원본(읽기 전용 보존)
  conditions_state text not null default 'pending'
    check (conditions_state in ('pending', 'extracted', 'confirmed')),

  -- 매칭 결과
  match_summary jsonb,      -- 작다. 목록 배지용
  match_rows    jsonb,      -- 크다. 상세에서만 읽는다

  -- 관리
  status     text not null default 'active' check (status in ('active', 'closed')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,

  constraint chk_announcements_title check (coalesce(btrim(title), '') <> ''),
  constraint chk_announcements_period
    check (apply_start is null or apply_end is null or apply_start <= apply_end)
);

comment on table public.announcements is
  '지원사업 공고. conditions 가 매칭의 유일한 입력이고 conditions_ai 는 AI 추출 원본 보존용.';
comment on column public.announcements.match_rows is
  '업체별 판정 상세. 목록 조회에서는 절대 select 하지 말 것 — 공고가 늘면 목록이 수 MB 가 된다.';

-- 같은 공고를 두 번 받지 않는다. 삭제분도 슬롯을 쥔다(위 주석 참고).
create unique index if not exists announcements_source_external_uniq
  on public.announcements (source, external_id);

create index if not exists idx_announcements_live
  on public.announcements (deleted_at, apply_end desc);   -- 목록·마감 배너

-- ── RLS — 새 테이블은 Supabase 기본값이 "열림"이다. 같은 커밋에서 켠다(CLAUDE.md 2-2).
--    새로 만드는 테이블이라 옛 정책은 없지만 관례대로 drop 후 create 한다.
alter table public.announcements enable row level security;

drop policy if exists p_announcements_select on public.announcements;
create policy p_announcements_select on public.announcements
  for select to authenticated using ((select public.is_approved()));

drop policy if exists p_announcements_insert on public.announcements;
create policy p_announcements_insert on public.announcements
  for insert to authenticated with check ((select public.is_approved()));

drop policy if exists p_announcements_update on public.announcements;
create policy p_announcements_update on public.announcements
  for update to authenticated
  using ((select public.is_approved())) with check ((select public.is_approved()));

-- DELETE 는 화면에서 soft delete(deleted_at)만 쓰지만, 휴지통 영구삭제를 1-B 에서
-- 붙일 수 있게 정책은 만들어 둔다(기업목록 휴지통과 같은 권한 = 승인된 팀원 전원).
drop policy if exists p_announcements_delete on public.announcements;
create policy p_announcements_delete on public.announcements
  for delete to authenticated using ((select public.is_approved()));

-- ── 권한 — anon 은 전부 회수, authenticated 도 필요한 것만 남긴다(CLAUDE.md 2-2)
revoke all on public.announcements from anon;
revoke all on public.announcements from authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
-- TRUNCATE 는 RLS 도 트리거도 우회한다. REFERENCES/TRIGGER 는 앱이 쓰지 않는다.
revoke truncate, references, trigger on public.announcements from authenticated, anon;

commit;
