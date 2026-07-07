-- ============================================================
-- 마감재 관리 (project_finishes)
-- 날짜: 2026-07-07
--
-- 대상 앱: /finishes 허브 + /finishes/[quoteId] 상세
-- 견적(quotes) 1건 = 현장 1곳 기준으로 마감재를 기록.
--   (finishes 페이지는 status='정산' 견적을 현장으로 취급)
--
-- ⚠️ 적용 전제:
--   - Layer2(migration_layer2_rls_roles.sql) 적용 완료
--     → is_admin(), is_assignee(uuid), project_assignees 존재.
--   - update_updated_at() 함수 존재(fresh_start.sql).
--   - Supabase SQL Editor에서 실행.
--
-- 쓰기 권한 결정:
--   마감재는 "정산 이후" 현장에서 팀 누구나 기록/수정하는 대장 성격이라
--   열람·쓰기 모두 로그인 전원(authenticated)에게 허용한다.
--   (quote_items의 can_edit_quote 잠금 규칙을 따르지 않음)
-- ============================================================

create table if not exists public.project_finishes (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes(id) on delete cascade,
  work_type       text not null,                 -- 화이트리스트 + 자유입력 공종 모두 허용
  location        text,                           -- 적용위치
  brand           text,
  vendor          text,                           -- 발주처 (내부전용)
  product_name    text,
  color_code      text,                           -- 컬러/품번
  installed_at    date,                           -- 시공일
  warranty_until  date,                           -- 보증만료
  note            text,
  customer_visible boolean not null default true,
  attrs           jsonb not null default '{}'::jsonb,  -- 규격/수량/단위/줄눈/매칭자재
  sort_order      integer,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_project_finishes_quote_id  on public.project_finishes (quote_id);
create index if not exists idx_project_finishes_work_type on public.project_finishes (work_type);

-- updated_at 자동 갱신 (기존 공용 함수 재사용)
drop trigger if exists trg_project_finishes_updated_at on public.project_finishes;
create trigger trg_project_finishes_updated_at
  before update on public.project_finishes
  for each row execute function public.update_updated_at();

-- ------------------------------------------------------------
-- RLS: 열람=로그인 전원 / 쓰기=로그인 전원
-- ------------------------------------------------------------
alter table public.project_finishes enable row level security;

drop policy if exists project_finishes_select on public.project_finishes;
create policy project_finishes_select on public.project_finishes
  for select to authenticated using (true);

drop policy if exists project_finishes_write on public.project_finishes;
create policy project_finishes_write on public.project_finishes
  for all to authenticated
  using (true) with check (true);

-- 검증
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'project_finishes'
ORDER BY policyname;

-- ============================================================
-- [롤백]
-- ============================================================
-- begin;
--   drop policy if exists project_finishes_select on public.project_finishes;
--   drop policy if exists project_finishes_write  on public.project_finishes;
--   drop trigger if exists trg_project_finishes_updated_at on public.project_finishes;
--   drop table if exists public.project_finishes;
-- commit;
