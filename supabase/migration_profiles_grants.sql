-- ============================================================
-- 긴급 수정: profiles 테이블 authenticated 권한 복구
-- 날짜: 2026-06-04
--
-- 증상: 로그인(authenticated) 유저가 profiles를 못 읽음
--   → SELECT 시 42501 "permission denied for table profiles"
--   → usePermissions의 isAdmin이 항상 false
--      = '팀 관리' 메뉴 미표시(관리자여도), UserMenu가 이름 대신 이메일,
--        견적 canEdit이 관리자 포함 전원 false(편집 불가).
--
-- 원인: profiles 생성 시 authenticated 역할에 GRANT를 주지 않음
--       (service_role에만 GRANT 돼 있었음 → 백필만 됐던 것).
--
-- 적용: Supabase SQL Editor에서 실행. (Layer1/2와 독립적으로 지금 적용 가능)
-- ============================================================

-- profiles UPDATE 정책에서 쓸 관리자 판정 함수 (Layer2와 동일 — 멱등).
-- security definer라 RLS/grant 무관하게 profiles를 읽어 재귀(무한루프) 없음.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 1) 권한(GRANT): 읽기=전원, 쓰기(역할 변경)=정책으로 admin만 제한
grant select, update on table public.profiles to authenticated;

-- 2) RLS 정책
alter table public.profiles enable row level security;

-- 열람: 로그인 전원 (이름/역할 표시, 팀관리 목록)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- 수정: 관리자만 (팀관리 페이지의 역할 토글)
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 검증
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated'
ORDER BY privilege_type;

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================================
-- [롤백]
-- ============================================================
-- drop policy if exists profiles_admin_update on public.profiles;
-- revoke update on table public.profiles from authenticated;
-- (profiles_select / grant select 는 앱 동작에 필수라 유지 권장)
