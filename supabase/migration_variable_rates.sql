-- ============================================================
-- Migration: 가변 요율 + 할인 저장 + 회사 설정 테이블
-- 날짜: 2026-05-10
--
-- 변경사항:
--   1. company_settings 테이블 신규 생성 (회사 단위 요율 저장)
--      - 단일 행으로 운영 (싱글톤 패턴)
--      - /template 페이지에서 요율을 여기에 저장/로드
--   2. quotes 테이블에 요율 컬럼 5개 추가
--      - 견적별로 다른 요율 가능
--      - 새 견적 작성 시 company_settings에서 복사해 시작
--   3. update_quote_totals 트리거를 가변 요율 참조로 수정
--   4. quotes 테이블의 요율/할인 변경 시도 트리거 발동
--   5. 기존 견적에 기본값 채우기 (견적 금액 변동 없음)
--
-- 안전성:
--   - IF NOT EXISTS / IF EXISTS 사용으로 멱등성 보장
--   - DEFAULT 값으로 기존 행 자동 채움
--   - CREATE OR REPLACE로 함수 안전 교체
-- ============================================================

-- ----- 1. company_settings 테이블 생성 -----

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_accident_insurance NUMERIC(6,4) NOT NULL DEFAULT 0.0378,
  rate_employment_insurance NUMERIC(6,4) NOT NULL DEFAULT 0.0205,
  rate_indirect_overhead NUMERIC(6,4) NOT NULL DEFAULT 0.05,
  rate_profit_margin NUMERIC(6,4) NOT NULL DEFAULT 0.15,
  rate_vat NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE company_settings IS '회사 단위 설정. 싱글톤(행 1개만 존재). /template에서 요율 관리.';
COMMENT ON COLUMN company_settings.rate_accident_insurance IS '산재보험료율 (노무비 대비). 0.0378 = 3.78%';
COMMENT ON COLUMN company_settings.rate_employment_insurance IS '고용보험료율 (노무비 대비). 0.0205 = 2.05%';
COMMENT ON COLUMN company_settings.rate_indirect_overhead IS '간접공사비율 (직접공사비 대비). 0.05 = 5%';
COMMENT ON COLUMN company_settings.rate_profit_margin IS '이윤율 (직접공사비 대비). 0.15 = 15%';
COMMENT ON COLUMN company_settings.rate_vat IS '부가세율. 0.10 = 10%';

-- 싱글톤 행 자동 생성 (이미 있으면 스킵)
INSERT INTO company_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- updated_at 자동 갱신 트리거
DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON company_settings;
CREATE TRIGGER trg_company_settings_updated_at
BEFORE UPDATE ON company_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ----- 2. quotes 테이블에 요율 컬럼 5개 추가 -----

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS rate_accident_insurance NUMERIC(6,4) NOT NULL DEFAULT 0.0378,
  ADD COLUMN IF NOT EXISTS rate_employment_insurance NUMERIC(6,4) NOT NULL DEFAULT 0.0205,
  ADD COLUMN IF NOT EXISTS rate_indirect_overhead NUMERIC(6,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS rate_profit_margin NUMERIC(6,4) NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS rate_vat NUMERIC(6,4) NOT NULL DEFAULT 0.10;

COMMENT ON COLUMN quotes.rate_accident_insurance IS '이 견적의 산재보험료율 (작성 시 company_settings에서 복사)';
COMMENT ON COLUMN quotes.rate_employment_insurance IS '이 견적의 고용보험료율';
COMMENT ON COLUMN quotes.rate_indirect_overhead IS '이 견적의 간접공사비율';
COMMENT ON COLUMN quotes.rate_profit_margin IS '이 견적의 이윤율';
COMMENT ON COLUMN quotes.rate_vat IS '이 견적의 부가세율';

-- discount_amount는 이미 존재함 (확인용)
-- 만약 없다면 추가:
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,0) NOT NULL DEFAULT 0;

-- ----- 3. update_quote_totals 함수를 가변 요율 참조 방식으로 변경 -----

CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_id UUID := COALESCE(NEW.quote_id, OLD.quote_id);
  v_rate_accident NUMERIC(6,4);
  v_rate_employment NUMERIC(6,4);
  v_rate_indirect NUMERIC(6,4);
  v_rate_profit NUMERIC(6,4);
  v_rate_vat NUMERIC(6,4);
  v_discount NUMERIC(15,0);
  v_total_material NUMERIC(15,0);
  v_total_labor NUMERIC(15,0);
  v_total_quote NUMERIC(15,0);
  v_total_execution NUMERIC(15,0);
  v_indirect_accident NUMERIC(15,0);
  v_indirect_employment NUMERIC(15,0);
  v_indirect_overhead NUMERIC(15,0);
  v_indirect_profit NUMERIC(15,0);
  v_total_indirect NUMERIC(15,0);
  v_vat NUMERIC(15,0);
BEGIN
  -- 현재 quote의 요율과 할인 가져오기
  SELECT
    rate_accident_insurance, rate_employment_insurance, rate_indirect_overhead,
    rate_profit_margin, rate_vat, COALESCE(discount_amount, 0)
  INTO
    v_rate_accident, v_rate_employment, v_rate_indirect,
    v_rate_profit, v_rate_vat, v_discount
  FROM quotes WHERE id = v_quote_id;

  -- quote_items 합계 계산
  SELECT
    COALESCE(SUM(material_amount), 0),
    COALESCE(SUM(labor_amount), 0),
    COALESCE(SUM(quote_amount), 0),
    COALESCE(SUM(execution_amount), 0)
  INTO
    v_total_material, v_total_labor, v_total_quote, v_total_execution
  FROM quote_items WHERE quote_id = v_quote_id;

  -- 간접비 계산 (가변 요율 적용)
  v_indirect_accident := FLOOR(v_total_labor * v_rate_accident);
  v_indirect_employment := FLOOR(v_total_labor * v_rate_employment);
  v_indirect_overhead := FLOOR(v_total_quote * v_rate_indirect);
  v_indirect_profit := FLOOR(v_total_quote * v_rate_profit);
  v_total_indirect := v_indirect_accident + v_indirect_employment + v_indirect_overhead + v_indirect_profit;
  v_vat := FLOOR((v_total_quote + v_total_indirect) * v_rate_vat);

  -- quotes 테이블 업데이트
  UPDATE quotes SET
    total_material_amount = v_total_material,
    total_labor_amount = v_total_labor,
    total_quote_amount = v_total_quote,
    total_execution_amount = v_total_execution,
    total_profit = v_total_quote - v_total_execution,
    total_profit_rate = CASE WHEN v_total_quote = 0 THEN 0
      ELSE ROUND(((v_total_quote - v_total_execution) / v_total_quote) * 100, 2) END,
    indirect_accident_insurance = v_indirect_accident,
    indirect_employment_insurance = v_indirect_employment,
    indirect_overhead = v_indirect_overhead,
    indirect_profit_margin = v_indirect_profit,
    total_indirect_cost = v_total_indirect,
    vat_amount = v_vat,
    final_amount = v_total_quote + v_total_indirect + v_vat - v_discount,
    updated_at = NOW()
  WHERE id = v_quote_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----- 4. quotes 자체 변경 시도 트리거에서 재계산 -----

CREATE OR REPLACE FUNCTION recalc_quote_totals_on_self_update()
RETURNS TRIGGER AS $$
DECLARE
  v_total_material NUMERIC(15,0);
  v_total_labor NUMERIC(15,0);
  v_total_quote NUMERIC(15,0);
  v_total_execution NUMERIC(15,0);
  v_indirect_accident NUMERIC(15,0);
  v_indirect_employment NUMERIC(15,0);
  v_indirect_overhead NUMERIC(15,0);
  v_indirect_profit NUMERIC(15,0);
  v_total_indirect NUMERIC(15,0);
  v_vat NUMERIC(15,0);
BEGIN
  -- quote_items 합계는 NEW에 이미 있는 total_*를 활용 (트리거가 이전에 채워뒀을 것)
  -- 다만 안전을 위해 다시 SELECT
  SELECT
    COALESCE(SUM(material_amount), 0),
    COALESCE(SUM(labor_amount), 0),
    COALESCE(SUM(quote_amount), 0),
    COALESCE(SUM(execution_amount), 0)
  INTO
    v_total_material, v_total_labor, v_total_quote, v_total_execution
  FROM quote_items WHERE quote_id = NEW.id;

  v_indirect_accident := FLOOR(v_total_labor * NEW.rate_accident_insurance);
  v_indirect_employment := FLOOR(v_total_labor * NEW.rate_employment_insurance);
  v_indirect_overhead := FLOOR(v_total_quote * NEW.rate_indirect_overhead);
  v_indirect_profit := FLOOR(v_total_quote * NEW.rate_profit_margin);
  v_total_indirect := v_indirect_accident + v_indirect_employment + v_indirect_overhead + v_indirect_profit;
  v_vat := FLOOR((v_total_quote + v_total_indirect) * NEW.rate_vat);

  NEW.total_material_amount := v_total_material;
  NEW.total_labor_amount := v_total_labor;
  NEW.total_quote_amount := v_total_quote;
  NEW.total_execution_amount := v_total_execution;
  NEW.total_profit := v_total_quote - v_total_execution;
  NEW.total_profit_rate := CASE WHEN v_total_quote = 0 THEN 0
    ELSE ROUND(((v_total_quote - v_total_execution) / v_total_quote) * 100, 2) END;
  NEW.indirect_accident_insurance := v_indirect_accident;
  NEW.indirect_employment_insurance := v_indirect_employment;
  NEW.indirect_overhead := v_indirect_overhead;
  NEW.indirect_profit_margin := v_indirect_profit;
  NEW.total_indirect_cost := v_total_indirect;
  NEW.vat_amount := v_vat;
  NEW.final_amount := v_total_quote + v_total_indirect + v_vat - COALESCE(NEW.discount_amount, 0);
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 할인 전용 트리거 제거 (새 트리거가 더 포괄적으로 처리)
DROP TRIGGER IF EXISTS trg_quotes_discount ON quotes;

-- 새 트리거: 요율이나 할인이 변경되면 자동 재계산
DROP TRIGGER IF EXISTS trg_quotes_self_update ON quotes;
CREATE TRIGGER trg_quotes_self_update
BEFORE UPDATE OF
  discount_amount,
  rate_accident_insurance,
  rate_employment_insurance,
  rate_indirect_overhead,
  rate_profit_margin,
  rate_vat
ON quotes
FOR EACH ROW
EXECUTE FUNCTION recalc_quote_totals_on_self_update();

-- ----- 5. 기존 견적에 기본값 명시적으로 채우기 -----

UPDATE quotes
SET
  rate_accident_insurance = COALESCE(rate_accident_insurance, 0.0378),
  rate_employment_insurance = COALESCE(rate_employment_insurance, 0.0205),
  rate_indirect_overhead = COALESCE(rate_indirect_overhead, 0.05),
  rate_profit_margin = COALESCE(rate_profit_margin, 0.15),
  rate_vat = COALESCE(rate_vat, 0.10),
  discount_amount = COALESCE(discount_amount, 0);

-- ----- 6. 마이그레이션 검증 (실행 후 결과 확인용) -----

-- company_settings 확인
SELECT * FROM company_settings;

-- quotes의 요율/할인 확인
SELECT
  id, quote_number,
  rate_accident_insurance, rate_employment_insurance,
  rate_indirect_overhead, rate_profit_margin, rate_vat,
  discount_amount,
  total_quote_amount, total_indirect_cost, vat_amount, final_amount
FROM quotes
ORDER BY created_at DESC;

-- 끝
