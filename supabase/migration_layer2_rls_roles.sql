-- ============================================================
-- Layer 2: 역할 기반 RLS (관리자 / 담당자 / 정산 잠금)
-- 날짜: 2026-06-04
--
-- ⚠️ 적용 전제:
--   - Layer1(migration_rls_authenticated_only.sql)을 먼저 적용했을 것.
--     (Layer1이 quotes/quote_items/quote_worktype_memos에 authenticated_all_* 정책을 만듦)
--   - 인증 게이트 배포 + 팀 계정/ profiles.role 세팅 완료.
--   - 직접 적용 금지 대상이 아니라면 Supabase SQL Editor에서 실행.
--
-- 규칙:
--   - 열람(SELECT): 로그인한 전원(authenticated)
--   - quotes 쓰기: 관리자  OR  (status <> '정산'  AND  해당 프로젝트 담당자)
--   - 자식(quote_items, quote_worktype_memos) 쓰기: 부모 견적이 편집 가능할 때(can_edit_quote)
--   - 정산('정산') 견적은 관리자만 수정
--   - 담당자 매핑: project_assignees (관리자만 add/remove)
--
-- 컬럼 확정값(Phase 0): quotes.id uuid / quotes.status / 정산='정산' /
--   quotes.project_id / projects.id uuid / quote_items.quote_id / quote_worktype_memos.quote_id
--
-- 순서 주의: 함수 is_assignee 가 project_assignees 를 참조하므로
--   (1) is_admin → (2) project_assignees 테이블/정책 → (3) is_assignee → (4) can_edit_quote 순.
-- ============================================================

-- 1) is_admin (profiles.role = 'admin')
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 2) 담당자 다대다 테이블 (+ 정책: 열람 전원 / 쓰기 관리자)
create table if not exists public.project_assignees (
  project_id uuid references public.projects(id) on delete cascade,
  user_id    uuid references auth.users(id)      on delete cascade,
  created_at timestamptz default now(),
  primary key (project_id, user_id)
);
alter table public.project_assignees enable row level security;

drop policy if exists pa_select on public.project_assignees;
create policy pa_select on public.project_assignees
  for select to authenticated using (true);

drop policy if exists pa_admin_write on public.project_assignees;
create policy pa_admin_write on public.project_assignees
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3) is_assignee (project_assignees 존재 후 생성)
create or replace function public.is_assignee(p_project uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_assignees
    where project_id = p_project and user_id = auth.uid()
  );
$$;

-- 4) can_edit_quote: 관리자 OR (정산아님 AND 담당자)
create or replace function public.can_edit_quote(p_quote uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.quotes q
    where q.id = p_quote
      and q.status <> '정산'
      and public.is_assignee(q.project_id)
  );
$$;

-- ------------------------------------------------------------
-- 5) quotes 정책: 열람=전원 / 쓰기=관리자 OR (정산아님 & 담당자)
--    Layer1 일괄정책 제거(authenticated_all_quotes, 구 allow_all_quotes 모두 방어적 제거)
-- ------------------------------------------------------------
drop policy if exists authenticated_all_quotes on public.quotes;
drop policy if exists allow_all_quotes          on public.quotes;

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select to authenticated using (true);

drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes
  for insert to authenticated
  with check (
    public.is_admin()
    or (status <> '정산' and public.is_assignee(project_id))
  );

drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes
  for update to authenticated
  using (
    public.is_admin()
    or (status <> '정산' and public.is_assignee(project_id))
  )
  with check (
    public.is_admin()
    or (status <> '정산' and public.is_assignee(project_id))
  );

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes
  for delete to authenticated
  using (
    public.is_admin()
    or (status <> '정산' and public.is_assignee(project_id))
  );

-- ------------------------------------------------------------
-- 6) 자식 테이블: 열람=전원 / 쓰기=can_edit_quote(부모 기준)
-- ------------------------------------------------------------
-- quote_items
drop policy if exists authenticated_all_quote_items on public.quote_items;
drop policy if exists allow_all_quote_items          on public.quote_items;
drop policy if exists quote_items_select on public.quote_items;
create policy quote_items_select on public.quote_items
  for select to authenticated using (true);
drop policy if exists quote_items_write on public.quote_items;
create policy quote_items_write on public.quote_items
  for all to authenticated
  using (public.can_edit_quote(quote_id))
  with check (public.can_edit_quote(quote_id));

-- quote_worktype_memos
drop policy if exists authenticated_all_quote_worktype_memos on public.quote_worktype_memos;
drop policy if exists allow_all_quote_worktype_memos          on public.quote_worktype_memos;
drop policy if exists quote_worktype_memos_select on public.quote_worktype_memos;
create policy quote_worktype_memos_select on public.quote_worktype_memos
  for select to authenticated using (true);
drop policy if exists quote_worktype_memos_write on public.quote_worktype_memos;
create policy quote_worktype_memos_write on public.quote_worktype_memos
  for all to authenticated
  using (public.can_edit_quote(quote_id))
  with check (public.can_edit_quote(quote_id));

-- 7) 나머지(unit_prices, company_settings, quote_templates, sms_alerts)는 Layer1 그대로
--    (전원 authenticated). 여기서 건드리지 않음.

-- 검증: quotes 정책이 select/insert/update/delete로 분리되었는지
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('quotes', 'quote_items', 'quote_worktype_memos', 'project_assignees')
ORDER BY tablename, policyname;

-- ============================================================
-- [롤백] Layer2 → Layer1(authenticated 일괄)로 되돌리기
-- ============================================================
-- begin;
--   drop policy if exists quotes_select on public.quotes;
--   drop policy if exists quotes_insert on public.quotes;
--   drop policy if exists quotes_update on public.quotes;
--   drop policy if exists quotes_delete on public.quotes;
--   create policy authenticated_all_quotes on public.quotes
--     for all to authenticated using (true) with check (true);
--
--   drop policy if exists quote_items_select on public.quote_items;
--   drop policy if exists quote_items_write  on public.quote_items;
--   create policy authenticated_all_quote_items on public.quote_items
--     for all to authenticated using (true) with check (true);
--
--   drop policy if exists quote_worktype_memos_select on public.quote_worktype_memos;
--   drop policy if exists quote_worktype_memos_write  on public.quote_worktype_memos;
--   create policy authenticated_all_quote_worktype_memos on public.quote_worktype_memos
--     for all to authenticated using (true) with check (true);
--
--   -- 담당자 테이블/함수 제거 (선택)
--   drop policy if exists pa_select       on public.project_assignees;
--   drop policy if exists pa_admin_write  on public.project_assignees;
--   drop table if exists public.project_assignees;
--   drop function if exists public.can_edit_quote(uuid);
--   drop function if exists public.is_assignee(uuid);
--   drop function if exists public.is_admin();
-- commit;
