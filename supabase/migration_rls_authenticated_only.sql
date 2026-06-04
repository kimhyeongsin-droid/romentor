-- ============================================================
-- Migration: RLS 강화 — anon 접근 제거, authenticated 전용
-- 날짜: 2026-06-04
--
-- ⚠️ 적용 순서 주의 (반드시 지킬 것):
--   1) Supabase Auth에 팀원 계정 전원 생성
--   2) 인증 게이트(proxy.ts / login / UserMenu) 배포 + 로그인 동작 확인
--   3) 그 다음에 이 마이그레이션 적용
-- 현재 배포본은 인증이 없어 anon으로 DB에 접근하므로, 이 마이그레이션을
-- 먼저 적용하면 운영 앱이 즉시 전면 차단됩니다(데이터 미표시/저장 실패).
--
-- 모델: 사내 공유 툴 → 행 소유권 없이 "로그인한 사용자 전원 전체 접근".
-- profiles 테이블은 별도(1·4단계)에서 구성했으므로 여기서 건드리지 않음.
--   → profiles 정책도 anon을 허용하지 않는지(authenticated 전용 또는
--     auth.uid() = id) 별도 확인 권장.
--
-- 동작: 대상 테이블마다 RLS 켜짐 보장 → 기존 정책 전부 제거(anon 허용 잔재 포함)
--       → authenticated 전용 정책 1개 생성. 존재하지 않는 테이블은 건너뜀(안전).
-- ============================================================

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'projects', 'quotes', 'quote_items', 'quote_worktype_memos',
    'sms_alerts', 'unit_prices', 'company_settings', 'quote_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- 기존 정책 전부 제거 (anon 허용 정책 잔재 방지)
      FOR p IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END LOOP;

      -- authenticated 전용 정책 생성
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        'authenticated_all_' || t, t
      );
    END IF;
  END LOOP;
END $$;

-- (선택) anon 테이블 권한 회수 — RLS로 이미 차단되지만 방어적 추가.
-- 필요 시 주석 해제:
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 검증: 각 테이블 정책이 {authenticated} 전용인지 확인 (roles에 anon이 없어야 함)
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'projects', 'quotes', 'quote_items', 'quote_worktype_memos',
    'sms_alerts', 'unit_prices', 'company_settings', 'quote_templates'
  )
ORDER BY tablename, policyname;
