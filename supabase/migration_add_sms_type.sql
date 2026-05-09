-- sms_alerts 테이블에 type 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE sms_alerts
  ADD COLUMN IF NOT EXISTS type TEXT
    CHECK (type IN ('payment', 'total', 'item', 'profit_warning', 'item_minus'));
