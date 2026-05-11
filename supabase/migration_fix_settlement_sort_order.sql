-- ============================================================
-- Migration: 정산 견적 항목 sort_order 정정
-- 날짜: 2026-05-11
--
-- 변경사항:
--   1. quote_items.sort_order 컬럼 추가 (이미 존재하면 무시)
--   2. 정산(type='정산') 견적의 항목 sort_order를
--      work_type 내 기존 sort_order → created_at → id 순으로 재할당
--
-- 안전성:
--   - ADD COLUMN IF NOT EXISTS 로 멱등성 보장
--   - 일반 견적(type!='정산') 항목은 건드리지 않음
-- ============================================================

-- 1. sort_order 컬럼 추가
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 2. 정산 견적 항목의 sort_order 재할당
--    PARTITION: quote_id + work_type 기준으로 0부터 순번 부여
WITH ranked AS (
  SELECT
    qi.id,
    ROW_NUMBER() OVER (
      PARTITION BY qi.quote_id, qi.work_type
      ORDER BY qi.sort_order NULLS LAST, qi.created_at, qi.id
    ) - 1 AS new_sort_order
  FROM quote_items qi
  INNER JOIN quotes q ON q.id = qi.quote_id
  WHERE q.type = '정산'
)
UPDATE quote_items qi
SET sort_order = ranked.new_sort_order
FROM ranked
WHERE qi.id = ranked.id;

-- 3. 검증
SELECT
  q.quote_number,
  qi.work_type,
  qi.sort_order,
  qi.item_name,
  qi.created_at
FROM quote_items qi
INNER JOIN quotes q ON q.id = qi.quote_id
WHERE q.type = '정산'
ORDER BY q.quote_number, qi.work_type, qi.sort_order;
