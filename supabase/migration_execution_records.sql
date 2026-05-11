-- ============================================================
-- Migration: 정산 견적서 지출 기록 컬럼 추가
-- 날짜: 2026-05-11
--
-- 변경사항:
--   quote_items 테이블에 다음 2개 컬럼 추가:
--   - execution_date: 실행(지출) 일자
--   - execution_memo: 실행(지출) 메모
--
-- 기존 컬럼:
--   - execution_amount: 그대로 유지 (변경 X)
--
-- 안전성:
--   - IF NOT EXISTS로 멱등성 보장
--   - NULL 허용 (기존 행에 영향 없음)
-- ============================================================

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS execution_date DATE,
  ADD COLUMN IF NOT EXISTS execution_memo TEXT;

COMMENT ON COLUMN quote_items.execution_date IS '실행(지출) 일자. 정산 견적에서 사용.';
COMMENT ON COLUMN quote_items.execution_memo IS '실행(지출) 메모. 정산 견적에서 사용.';

-- 검증
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quote_items'
  AND column_name IN ('execution_amount', 'execution_date', 'execution_memo')
ORDER BY column_name;
