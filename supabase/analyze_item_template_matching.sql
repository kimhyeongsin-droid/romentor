-- ============================================================
-- 분석용 SQL: quote_items와 quote_templates 매칭 통계
-- 날짜: 2026-05-11
--
-- 목적:
--   sort_order 정정 마이그레이션을 만들기 전에 안전성 확인.
--   UPDATE 안 함. SELECT만.
--
-- 매칭 기준:
--   work_type + item_name (size_category는 무시 — 견적이 어떤 size로 만들어졌는지 추적 안 됨)
-- ============================================================

-- ===== 1. 견적별 매칭 통계 =====
SELECT
  q.quote_number,
  q.type,
  COUNT(qi.id) AS total_items,
  COUNT(CASE WHEN qt_match.matched > 0 THEN 1 END) AS matched_items,
  COUNT(CASE WHEN qt_match.matched IS NULL OR qt_match.matched = 0 THEN 1 END) AS unmatched_items,
  ROUND(100.0 * COUNT(CASE WHEN qt_match.matched > 0 THEN 1 END) / COUNT(qi.id), 1) AS match_pct
FROM quotes q
JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS matched
  FROM quote_templates qt
  WHERE qt.work_type = qi.work_type
    AND qt.item_name = qi.item_name
) qt_match ON true
GROUP BY q.quote_number, q.type
ORDER BY q.quote_number;

-- ===== 2. 매칭 안 되는 항목 전체 목록 =====
-- (이 항목들은 마이그레이션 시 끝으로 정렬되거나 그대로 유지됨)
SELECT
  q.quote_number,
  qi.work_type,
  qi.item_name,
  qi.sort_order AS current_sort_order,
  '템플릿에 없음' AS status
FROM quote_items qi
JOIN quotes q ON q.id = qi.quote_id
LEFT JOIN quote_templates qt
  ON qt.work_type = qi.work_type
  AND qt.item_name = qi.item_name
WHERE qt.id IS NULL
  AND qi.item_name IS NOT NULL
  AND qi.item_name != ''
ORDER BY q.quote_number, qi.work_type, qi.sort_order
LIMIT 50;

-- ===== 3. 같은 work_type+item_name으로 quote_templates에 여러 행이 있는 경우 =====
-- (size_category가 달라서 중복될 수 있음 — 매칭 시 어떤 sort_order를 쓸지 결정 필요)
SELECT
  work_type,
  item_name,
  COUNT(*) AS template_count,
  STRING_AGG(size_category || ':' || sort_order::text, ', ') AS variants
FROM quote_templates
WHERE item_name IS NOT NULL
  AND item_name != ''
GROUP BY work_type, item_name
HAVING COUNT(*) > 1
ORDER BY work_type, item_name
LIMIT 30;

-- ===== 4. 같은 size_category 안에서 중복 항목 =====
-- (잘 만들어진 템플릿이면 중복 없어야 함)
SELECT
  size_category,
  work_type,
  item_name,
  COUNT(*) AS dup_count
FROM quote_templates
WHERE item_name IS NOT NULL
  AND item_name != ''
GROUP BY size_category, work_type, item_name
HAVING COUNT(*) > 1
ORDER BY size_category, work_type;
