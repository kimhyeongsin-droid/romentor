-- ============================================================
-- Migration: 모든 견적의 quote_items sort_order를 quote_templates에 맞춰 정정
-- 날짜: 2026-05-11
--
-- 변경사항:
--   모든 견적의 quote_items.sort_order를 work_type + item_name 기준으로
--   quote_templates의 sort_order로 재할당
--
-- 매칭 규칙:
--   - quote_templates에 있는 항목: 해당 sort_order로 업데이트
--   - quote_templates에 없는 항목 (사용자 추가): sort_order에 10000을 더해 끝으로 보냄
--     (work_type 내에서 기존 상대 순서는 유지)
--
-- 안전성:
--   - 트랜잭션으로 묶음 (BEGIN/COMMIT)
--   - 백업 테이블 생성 (롤백 가능)
-- ============================================================

BEGIN;

-- 1. 백업 테이블 생성 (혹시 모를 롤백용)
CREATE TABLE IF NOT EXISTS quote_items_backup_20260511_sort_order AS
SELECT id, quote_id, work_type, item_name, sort_order
FROM quote_items;

-- 2. 매칭되는 항목: quote_templates의 sort_order로 업데이트
-- (각 항목이 여러 size_category에 같은 sort_order를 가지므로 DISTINCT로 처리)
WITH template_sort AS (
  SELECT DISTINCT ON (work_type, item_name)
    work_type,
    item_name,
    sort_order
  FROM quote_templates
  WHERE item_name IS NOT NULL AND item_name != ''
)
UPDATE quote_items qi
SET sort_order = ts.sort_order
FROM template_sort ts
WHERE qi.work_type = ts.work_type
  AND qi.item_name = ts.item_name;

-- 3. 매칭 안 되는 항목: 기존 sort_order에 10000을 더해 끝으로 보냄
-- (work_type 내에서 기존 상대 순서는 유지)
UPDATE quote_items qi
SET sort_order = COALESCE(qi.sort_order, 0) + 10000
WHERE NOT EXISTS (
  SELECT 1 FROM quote_templates qt
  WHERE qt.work_type = qi.work_type
    AND qt.item_name = qi.item_name
    AND qt.item_name IS NOT NULL
    AND qt.item_name != ''
);

-- 4. 검증 SELECT 1: 정산 견적의 가설공사 순서 (template 순서와 일치해야 함)
SELECT
  q.quote_number,
  qi.work_type,
  qi.sort_order,
  qi.item_name,
  CASE WHEN qi.sort_order >= 10000 THEN '미매칭 (끝)' ELSE '매칭됨' END AS status
FROM quote_items qi
JOIN quotes q ON q.id = qi.quote_id
WHERE q.quote_number = 'RMT-20260509-002'
  AND qi.work_type = '가설공사'
ORDER BY qi.sort_order;

-- 5. 검증 SELECT 2: 전체 통계
SELECT
  '전체' AS scope,
  COUNT(*) AS total_items,
  COUNT(CASE WHEN sort_order >= 10000 THEN 1 END) AS unmatched_items,
  COUNT(CASE WHEN sort_order < 10000 THEN 1 END) AS matched_items
FROM quote_items;

-- 결과 확인 후 문제 없으면:
COMMIT;

-- 만약 문제 있으면 ROLLBACK 하고 백업에서 복원:
-- ROLLBACK;
-- UPDATE quote_items qi
-- SET sort_order = b.sort_order
-- FROM quote_items_backup_20260511_sort_order b
-- WHERE qi.id = b.id;
