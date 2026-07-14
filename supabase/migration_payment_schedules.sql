-- ============================================================
-- Migration: 입금 일정(payment_schedules) + 자동 문자 알림 설정
-- 날짜: 2026-07-13
-- Supabase SQL Editor에서 실행하세요. (멱등 — 여러 번 실행해도 안전)
-- ============================================================

-- 1) 프로젝트별 자동발송 스위치
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sms_auto_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) 전역 설정(app_settings) — 싱글턴(id=1)
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  sms_auto_enabled       BOOLEAN NOT NULL DEFAULT FALSE,  -- 전체 마스터 스위치(기본 OFF: 수동 발송만)
  overdue_interval_days  INT     NOT NULL DEFAULT 3,      -- 지연 알림 N일 간격
  overdue_max_count      INT     NOT NULL DEFAULT 5,      -- 지연 알림 최대 횟수(안전장치)
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3) 입금 일정 테이블
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label   TEXT NOT NULL,                       -- 계약금/착수금/중도금/잔금/기타(자유입력)
  amount  NUMERIC(15,0) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,                      -- 입금(처리) 예정일
  status  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  memo    TEXT,
  reminder_sent_at     TIMESTAMPTZ,            -- 예정일 당일 알림 발송 시각(1회)
  last_overdue_sent_at TIMESTAMPTZ,            -- 마지막 지연 알림 발송 시각
  overdue_count        INT NOT NULL DEFAULT 0, -- 지연 알림 발송 횟수
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_project ON payment_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due ON payment_schedules(due_date) WHERE status = 'pending';

-- updated_at 자동 갱신 트리거 (schema.sql의 update_updated_at() 재사용)
DROP TRIGGER IF EXISTS trg_payment_schedules_updated_at ON payment_schedules;
CREATE TRIGGER trg_payment_schedules_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4) sms_alerts: 결제 알림용 컬럼 + 새 type 값 허용
ALTER TABLE sms_alerts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE sms_alerts
  ADD COLUMN IF NOT EXISTS project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_schedule_id UUID REFERENCES payment_schedules(id) ON DELETE SET NULL;

ALTER TABLE sms_alerts DROP CONSTRAINT IF EXISTS sms_alerts_type_check;
ALTER TABLE sms_alerts
  ADD CONSTRAINT sms_alerts_type_check
  CHECK (type IN ('payment','total','item','profit_warning','item_minus','payment_reminder','payment_overdue'));

-- 5) RLS: 로그인 사용자 전체 접근(기존 패턴 동일). cron은 service_role로 우회.
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_payment_schedules ON payment_schedules;
CREATE POLICY authenticated_all_payment_schedules ON payment_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_app_settings ON app_settings;
CREATE POLICY authenticated_all_app_settings ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6) 테이블 권한 부여 (Supabase: authenticated/service_role에 GRANT 필요)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payment_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_settings TO authenticated;
GRANT ALL ON TABLE payment_schedules TO service_role;
GRANT ALL ON TABLE app_settings TO service_role;

-- 검증
SELECT 'payment_schedules' AS tbl, count(*) FROM payment_schedules
UNION ALL SELECT 'app_settings', count(*) FROM app_settings;
