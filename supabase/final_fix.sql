-- ============================================================
-- final_fix.sql — 함수/트리거 완전 삭제 후 재생성
-- ============================================================

-- ── 1. 함수 CASCADE 삭제 (의존 트리거 자동 삭제) ─────────────
DROP FUNCTION IF EXISTS update_quote_totals()      CASCADE;
DROP FUNCTION IF EXISTS recalc_final_on_discount() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()        CASCADE;

-- ── 2. 혹시 남아있는 트리거 명시적 삭제 ─────────────────────
DROP TRIGGER IF EXISTS trg_update_quote_totals    ON quote_items;
DROP TRIGGER IF EXISTS trg_quotes_discount        ON quotes;
DROP TRIGGER IF EXISTS trg_projects_updated_at    ON projects;
DROP TRIGGER IF EXISTS trg_unit_prices_updated_at ON unit_prices;
DROP TRIGGER IF EXISTS trg_quotes_updated_at      ON quotes;
DROP TRIGGER IF EXISTS trg_quote_items_updated_at ON quote_items;

-- ── 3. quote_items — generated 컬럼 완전 재구성 ─────────────
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit_rate     CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit          CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS quote_amount    CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS labor_amount    CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS material_amount CASCADE;

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0;

UPDATE quote_items
  SET material_unit_price = unit_price
  WHERE material_unit_price = 0 AND unit_price > 0;

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

-- ── 4. quotes — 누락 컬럼 보장 ──────────────────────────────
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

-- ── 5. 견적 합계 함수 새로 생성 ─────────────────────────────
CREATE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  qid        UUID;
  mat        NUMERIC(15,0);
  lab        NUMERIC(15,0);
  direct     NUMERIC(15,0);
  exec_amt   NUMERIC(15,0);
  acc        NUMERIC(15,0);
  emp        NUMERIC(15,0);
  ovh        NUMERIC(15,0);
  pmg        NUMERIC(15,0);
  indir      NUMERIC(15,0);
  vat        NUMERIC(15,0);
  disc       NUMERIC(15,0);
BEGIN
  qid := COALESCE(NEW.quote_id, OLD.quote_id);

  SELECT
    COALESCE(SUM(material_amount),  0),
    COALESCE(SUM(labor_amount),     0),
    COALESCE(SUM(quote_amount),     0),
    COALESCE(SUM(execution_amount), 0)
  INTO mat, lab, direct, exec_amt
  FROM quote_items WHERE quote_id = qid;

  acc   := FLOOR(lab    * 0.0378);
  emp   := FLOOR(lab    * 0.0205);
  ovh   := FLOOR(direct * 0.05);
  pmg   := FLOOR(direct * 0.15);
  indir := acc + emp + ovh + pmg;
  vat   := FLOOR((direct + indir) * 0.1);

  SELECT COALESCE(discount_amount, 0) INTO disc FROM quotes WHERE id = qid;

  UPDATE quotes SET
    total_material_amount         = mat,
    total_labor_amount            = lab,
    total_quote_amount            = direct,
    total_execution_amount        = exec_amt,
    total_profit                  = direct - exec_amt,
    total_profit_rate             = CASE WHEN direct = 0 THEN 0
      ELSE ROUND(((direct - exec_amt)::NUMERIC / direct) * 100, 2) END,
    indirect_accident_insurance   = acc,
    indirect_employment_insurance = emp,
    indirect_overhead             = ovh,
    indirect_profit_margin        = pmg,
    total_indirect_cost           = indir,
    vat_amount                    = vat,
    final_amount                  = direct + indir + vat - disc,
    updated_at                    = NOW()
  WHERE id = qid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW EXECUTE FUNCTION update_quote_totals();

-- ── 6. 할인 변경 → 최종금액 재계산 함수 ─────────────────────
CREATE FUNCTION recalc_final_on_discount()
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

-- ── 7. updated_at 함수 ───────────────────────────────────────
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at    BEFORE UPDATE ON projects    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_unit_prices_updated_at BEFORE UPDATE ON unit_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated_at      BEFORE UPDATE ON quotes      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quote_items_updated_at BEFORE UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 8. 기존 데이터 합계 강제 재계산 ─────────────────────────
UPDATE quote_items SET note = note WHERE TRUE;

-- ── 9. 결과 확인 ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='quote_items' AND column_name='quote_amount')    AS quote_amount_ok,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='quote_items' AND column_name='material_amount') AS material_amount_ok,
  (SELECT COUNT(*) FROM information_schema.routines
   WHERE routine_name='update_quote_totals')                         AS trigger_fn_ok,
  (SELECT COUNT(*) FROM information_schema.triggers
   WHERE trigger_name='trg_update_quote_totals')                     AS trigger_ok;
