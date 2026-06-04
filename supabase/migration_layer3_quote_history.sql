-- ============================================================
-- Layer 3: 견적 변경 감사 로그 (quote_history)
-- 날짜: 2026-06-04
--
-- 전제: Layer1, Layer2 적용 후. Supabase SQL Editor에서 실행.
-- 동작: quotes INSERT/UPDATE/DELETE 시 트리거(security definer)가
--       quote_history에 누가/언제/무엇을 자동 기록. 클라이언트 직접 쓰기 불가(열람만).
-- 컬럼 확정값(Phase 0): quotes.id = uuid (PK)
-- ============================================================

create table if not exists public.quote_history (
  id          bigint generated always as identity primary key,
  quote_id    uuid,
  action      text,
  changed_by  uuid default auth.uid(),
  changed_at  timestamptz default now(),
  old_data    jsonb,
  new_data    jsonb
);

alter table public.quote_history enable row level security;

-- 열람: 로그인 전원
drop policy if exists qh_select on public.quote_history;
create policy qh_select on public.quote_history
  for select to authenticated using (true);
-- 클라이언트 쓰기 정책 없음 → 트리거(security definer)로만 기록됨

-- 기록 함수
create or replace function public.log_quote_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.quote_history (quote_id, action, changed_by, old_data, new_data)
  values (
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- 트리거
drop trigger if exists trg_log_quote_change on public.quotes;
create trigger trg_log_quote_change
  after insert or update or delete on public.quotes
  for each row execute function public.log_quote_change();

-- 검증: 최근 이력 확인용(적용 직후엔 비어 있을 수 있음)
-- SELECT id, quote_id, action, changed_by, changed_at FROM public.quote_history ORDER BY changed_at DESC LIMIT 20;

-- ============================================================
-- [롤백] Layer3 제거
-- ============================================================
-- begin;
--   drop trigger if exists trg_log_quote_change on public.quotes;
--   drop function if exists public.log_quote_change();
--   drop policy if exists qh_select on public.quote_history;
--   drop table if exists public.quote_history;
-- commit;
