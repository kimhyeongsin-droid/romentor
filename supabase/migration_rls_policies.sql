-- ============================================================
-- Migration: company_settings + quote_templates RLS 정책
-- 날짜: 2026-05-10
-- 다른 테이블(projects, quotes 등)과 동일한 패턴으로 통일
-- ============================================================

-- company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_company_settings" ON company_settings;
CREATE POLICY "allow_all_company_settings"
ON company_settings FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

-- quote_templates
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_quote_templates" ON quote_templates;
CREATE POLICY "allow_all_quote_templates"
ON quote_templates FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

-- ----- GRANT 권한 -----
-- Supabase anon/authenticated role에게 테이블 접근 권한 부여
-- (다른 테이블들과 동일한 패턴)
GRANT ALL ON company_settings TO anon, authenticated;
GRANT ALL ON quote_templates TO anon, authenticated;

-- 검증
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('company_settings','quote_templates','quotes','projects')
ORDER BY tablename;

SELECT tablename, policyname, roles FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('company_settings','quote_templates')
ORDER BY tablename;

-- GRANT 확인
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('company_settings', 'quote_templates')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT * FROM company_settings;
