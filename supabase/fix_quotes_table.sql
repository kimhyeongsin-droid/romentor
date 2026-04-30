-- ============================================================
-- fix_quotes_table.sql — quote_items generated 컬럼 및 quotes 누락 컬럼 복구
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ── 1. quote_items: generated 컬럼 안전 재구성 ───────────────

-- 의존 트리거 제거 (재생성할 것이므로 미리 삭제)
DROP TRIGGER IF EXISTS trg_update_quote_totals ON quote_items;

-- 기존 generated 컬럼 제거 (없어도 에러 안 남)
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit_rate  CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit       CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS quote_amount CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS labor_amount CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS material_amount CASCADE;

-- 재료비/노무비 단가 컬럼 보장
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0;

-- unit_price → material_unit_price 이전 (기존 데이터 보호)
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

-- ── 2. quotes: 누락 컬럼 보장 ───────────────────────────────

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

-- ── 3. 견적 합계 트리거 함수 재생성 ─────────────────────────

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

DROP TRIGGER IF EXISTS trg_update_quote_totals ON quote_items;
CREATE TRIGGER trg_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW EXECUTE FUNCTION update_quote_totals();

-- ── 4. 할인 변경 시 최종금액 재계산 트리거 ─────────────────

CREATE OR REPLACE FUNCTION recalc_final_on_discount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_amount :=
    NEW.total_quote_amount + NEW.total_indirect_cost + NEW.vat_amount - NEW.discount_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotes_discount ON quotes;
CREATE TRIGGER trg_quotes_discount
BEFORE UPDATE OF discount_amount ON quotes
FOR EACH ROW EXECUTE FUNCTION recalc_final_on_discount();

-- ── 5. updated_at 트리거 보장 ────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at    ON projects;
DROP TRIGGER IF EXISTS trg_unit_prices_updated_at ON unit_prices;
DROP TRIGGER IF EXISTS trg_quotes_updated_at      ON quotes;
DROP TRIGGER IF EXISTS trg_quote_items_updated_at ON quote_items;

CREATE TRIGGER trg_projects_updated_at    BEFORE UPDATE ON projects    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_unit_prices_updated_at BEFORE UPDATE ON unit_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated_at      BEFORE UPDATE ON quotes      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quote_items_updated_at BEFORE UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 6. 기존 quotes 합계 강제 재계산 ─────────────────────────
-- quote_items에 임시 no-op UPDATE를 걸어 트리거를 발동시킵니다.
UPDATE quote_items SET note = note WHERE TRUE;

-- ── 완료 확인 ────────────────────────────────────────────────
SELECT 'fix_quotes_table.sql 완료 — quote_items 컬럼 및 트리거 재설정 성공' AS result;
