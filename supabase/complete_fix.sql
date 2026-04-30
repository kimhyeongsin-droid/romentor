-- ============================================================
-- complete_fix.sql — 로멘토 DB 완전 재설정
-- Supabase SQL Editor에서 한 번에 실행하세요.
-- 멱등(idempotent): 몇 번 실행해도 안전합니다.
-- ============================================================

-- ── STEP 0: 모든 관련 트리거 제거 ──────────────────────────
DROP TRIGGER IF EXISTS trg_update_quote_totals    ON quote_items;
DROP TRIGGER IF EXISTS trg_quotes_discount        ON quotes;
DROP TRIGGER IF EXISTS trg_projects_updated_at    ON projects;
DROP TRIGGER IF EXISTS trg_unit_prices_updated_at ON unit_prices;
DROP TRIGGER IF EXISTS trg_quotes_updated_at      ON quotes;
DROP TRIGGER IF EXISTS trg_quote_items_updated_at ON quote_items;

-- ── STEP 1: quote_items — work_type CHECK 제약 최신화 ───────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'quote_items'::regclass AND contype = 'c'
      AND conname LIKE '%work_type%'
  ) LOOP
    EXECUTE format('ALTER TABLE quote_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE quote_items ADD CONSTRAINT quote_items_work_type_check CHECK (
  work_type IN (
    '가설공사','철거','마루철거','설비','전기배선',
    '창호','목공','도어','타일','도장',
    '필름','도배','욕실도기','조명','바닥',
    '가구','금속','유리실리콘','공조','홈스타일링'
  )
);

-- ── STEP 2: quote_items — generated 컬럼 안전 재구성 ────────
-- 의존 컬럼부터 순서대로 제거
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit_rate    CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit         CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS quote_amount   CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS labor_amount   CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS material_amount CASCADE;

-- 재료비 / 노무비 단가 컬럼 보장
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0;

-- 기존 unit_price → material_unit_price 데이터 이전 (손실 방지)
UPDATE quote_items
  SET material_unit_price = unit_price
  WHERE material_unit_price = 0 AND unit_price > 0;

-- Generated 컬럼 재생성
ALTER TABLE quote_items
  ADD COLUMN material_amount NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price)
  ) STORED,
  ADD COLUMN labor_amount NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * labor_unit_price)
  ) STORED,
  ADD COLUMN quote_amount NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price)
  ) STORED,
  ADD COLUMN profit NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price) - execution_amount
  ) STORED,
  ADD COLUMN profit_rate NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE
      WHEN (FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price)) = 0 THEN 0
      ELSE ROUND(
        ((FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price) - execution_amount)::NUMERIC
          / (FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price))) * 100, 2
      )
    END
  ) STORED;

-- ── STEP 3: quotes — 누락 컬럼 보장 ────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS total_material_amount         NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_labor_amount            NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_accident_insurance   NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_employment_insurance NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_overhead             NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_profit_margin        NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_indirect_cost           NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount                    NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount               NUMERIC(15,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount                  NUMERIC(15,0) DEFAULT 0;

-- ── STEP 4: 견적 합계 트리거 함수 재생성 ────────────────────
CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_id   UUID;
  v_material   NUMERIC(15,0);
  v_labor      NUMERIC(15,0);
  v_direct     NUMERIC(15,0);
  v_exec       NUMERIC(15,0);
  v_accident   NUMERIC(15,0);
  v_employment NUMERIC(15,0);
  v_overhead   NUMERIC(15,0);
  v_profit_mg  NUMERIC(15,0);
  v_indirect   NUMERIC(15,0);
  v_vat        NUMERIC(15,0);
  v_discount   NUMERIC(15,0);
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);

  SELECT
    COALESCE(SUM(material_amount),  0),
    COALESCE(SUM(labor_amount),     0),
    COALESCE(SUM(quote_amount),     0),
    COALESCE(SUM(execution_amount), 0)
  INTO v_material, v_labor, v_direct, v_exec
  FROM quote_items WHERE quote_id = v_quote_id;

  v_accident   := FLOOR(v_labor  * 0.0378);
  v_employment := FLOOR(v_labor  * 0.0205);
  v_overhead   := FLOOR(v_direct * 0.05);
  v_profit_mg  := FLOOR(v_direct * 0.15);
  v_indirect   := v_accident + v_employment + v_overhead + v_profit_mg;
  v_vat        := FLOOR((v_direct + v_indirect) * 0.1);

  SELECT COALESCE(discount_amount, 0) INTO v_discount FROM quotes WHERE id = v_quote_id;

  UPDATE quotes SET
    total_material_amount         = v_material,
    total_labor_amount            = v_labor,
    total_quote_amount            = v_direct,
    total_execution_amount        = v_exec,
    total_profit                  = v_direct - v_exec,
    total_profit_rate             = CASE WHEN v_direct = 0 THEN 0
      ELSE ROUND(((v_direct - v_exec)::NUMERIC / v_direct) * 100, 2) END,
    indirect_accident_insurance   = v_accident,
    indirect_employment_insurance = v_employment,
    indirect_overhead             = v_overhead,
    indirect_profit_margin        = v_profit_mg,
    total_indirect_cost           = v_indirect,
    vat_amount                    = v_vat,
    final_amount                  = v_direct + v_indirect + v_vat - v_discount,
    updated_at                    = NOW()
  WHERE id = v_quote_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW EXECUTE FUNCTION update_quote_totals();

-- ── STEP 5: 할인 변경 → 최종금액 재계산 트리거 ──────────────
CREATE OR REPLACE FUNCTION recalc_final_on_discount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_amount :=
    NEW.total_quote_amount + NEW.total_indirect_cost + NEW.vat_amount - NEW.discount_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quotes_discount
BEFORE UPDATE OF discount_amount ON quotes
FOR EACH ROW EXECUTE FUNCTION recalc_final_on_discount();

-- ── STEP 6: updated_at 트리거 재설정 ────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at    BEFORE UPDATE ON projects    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_unit_prices_updated_at BEFORE UPDATE ON unit_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated_at      BEFORE UPDATE ON quotes      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quote_items_updated_at BEFORE UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── STEP 7: 뷰 재생성 ────────────────────────────────────────

-- 공종별 재료비/노무비 집계 뷰
CREATE OR REPLACE VIEW v_work_type_summary AS
SELECT
  qi.work_type,
  COUNT(*)                        AS item_count,
  COALESCE(SUM(qi.material_amount), 0)  AS total_material,
  COALESCE(SUM(qi.labor_amount),    0)  AS total_labor,
  COALESCE(SUM(qi.quote_amount),    0)  AS total_quote,
  COALESCE(SUM(qi.execution_amount),0)  AS total_execution,
  COALESCE(SUM(qi.profit),          0)  AS total_profit
FROM quote_items qi
GROUP BY qi.work_type;

-- 견적별 요약 뷰 (프로젝트 정보 포함)
CREATE OR REPLACE VIEW v_quote_summary AS
SELECT
  q.id,
  q.quote_number,
  q.version,
  q.status,
  p.name          AS project_name,
  p.client_name,
  p.manager_name,
  p.manager_phone,
  q.total_material_amount,
  q.total_labor_amount,
  q.total_quote_amount,
  q.total_execution_amount,
  q.total_profit,
  q.total_profit_rate,
  q.total_indirect_cost,
  q.vat_amount,
  q.discount_amount,
  q.final_amount,
  q.created_at,
  q.updated_at
FROM quotes q
JOIN projects p ON p.id = q.project_id;

-- ── STEP 8: 기존 데이터 합계 강제 재계산 ─────────────────────
-- note no-op UPDATE로 트리거 발동 → quotes 합계 즉시 갱신
UPDATE quote_items SET note = note WHERE TRUE;

-- ── 완료 확인 ────────────────────────────────────────────────
SELECT
  'complete_fix.sql 완료' AS result,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'quote_items' AND column_name = 'quote_amount') AS quote_amount_exists,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'quote_items' AND column_name = 'material_amount') AS material_amount_exists,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'quotes'      AND column_name = 'final_amount') AS final_amount_exists,
  (SELECT COUNT(*) FROM information_schema.views
   WHERE table_name IN ('v_work_type_summary','v_quote_summary')) AS views_created,
  (SELECT COUNT(*) FROM information_schema.triggers
   WHERE trigger_name LIKE 'trg_%') AS triggers_count;
