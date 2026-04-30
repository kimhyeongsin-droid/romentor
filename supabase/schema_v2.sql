-- ============================================================
-- schema_v2.sql — 로멘토 엑셀 포맷 업그레이드 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. unit_prices / quote_items 의 work_type CHECK 제약을 동적으로 모두 삭제
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'unit_prices'::regclass AND contype = 'c'
  ) LOOP
    EXECUTE format('ALTER TABLE unit_prices DROP CONSTRAINT %I', r.conname);
  END LOOP;

  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'quote_items'::regclass AND contype = 'c'
  ) LOOP
    EXECUTE format('ALTER TABLE quote_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. 새 CHECK 제약 추가 (20개 공종)
ALTER TABLE unit_prices ADD CONSTRAINT unit_prices_work_type_check CHECK (
  work_type IN (
    '가설공사','철거','마루철거','설비','전기배선',
    '창호','목공','도어','타일','도장',
    '필름','도배','욕실도기','조명','바닥',
    '가구','금속','유리실리콘','공조','홈스타일링'
  )
);

ALTER TABLE quote_items ADD CONSTRAINT quote_items_work_type_check CHECK (
  work_type IN (
    '가설공사','철거','마루철거','설비','전기배선',
    '창호','목공','도어','타일','도장',
    '필름','도배','욕실도기','조명','바닥',
    '가구','금속','유리실리콘','공조','홈스타일링'
  )
);

-- 3. unit_prices — 재료비/노무비 단가 컬럼 추가
ALTER TABLE unit_prices
  ADD COLUMN IF NOT EXISTS material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0;

-- 4. quote_items — generated 컬럼 재구성 (재료비/노무비 분리)
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit_rate  CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS profit       CASCADE;
ALTER TABLE quote_items DROP COLUMN IF EXISTS quote_amount CASCADE;

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0;

-- 기존 unit_price → material_unit_price 이전
UPDATE quote_items
  SET material_unit_price = unit_price
  WHERE material_unit_price = 0 AND unit_price > 0;

-- Generated 컬럼 재생성
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS material_amount NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price)
  ) STORED,
  ADD COLUMN IF NOT EXISTS labor_amount NUMERIC(15,0) GENERATED ALWAYS AS (
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

-- 5. quotes — 간접공사비 / 부가세 / 할인 / 최종금액 컬럼 추가
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

-- 6. 견적 합계 트리거 함수 업데이트
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

-- 7. 단수할인 변경 시 최종금액 재계산 트리거
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

-- 8. 기존 단가 데이터 교체 (로멘토 샘플)
DELETE FROM unit_prices;

INSERT INTO unit_prices (work_type, item_name, unit, material_unit_price, labor_unit_price, unit_price) VALUES
-- 가설공사
('가설공사', '가설울타리',            'm',       3000,   5000,   8000),
('가설공사', '가설사무실',            '식',    300000, 200000, 500000),
('가설공사', '안전시설 설치',         '식',    200000, 150000, 350000),
-- 철거
('철거', '바닥재 철거',               'm²',     3000,  15000,  18000),
('철거', '벽체 타일 철거',            'm²',     5000,  17000,  22000),
('철거', '천장 철거',                 'm²',     3000,  17000,  20000),
('철거', '문짝 철거',                 '개',     5000,  30000,  35000),
('철거', '벽체 철거 (조적)',          'm²',     8000,  22000,  30000),
-- 마루철거
('마루철거', '강마루 철거',           'm²',     2000,  10000,  12000),
('마루철거', '원목마루 철거',         'm²',     3000,  12000,  15000),
('마루철거', '장판 철거',             'm²',     1000,   6000,   7000),
-- 설비
('설비', '세면대 교체',               '개',   150000, 150000, 300000),
('설비', '변기 교체',                 '개',   200000, 150000, 350000),
('설비', '보일러 교체',               '식',   800000, 400000,1200000),
('설비', '욕조 설치',                 '개',   300000, 200000, 500000),
('설비', '배관 이설',                 'm',     15000,  25000,  40000),
-- 전기배선
('전기배선', '콘센트 이설',           '개',    10000,  40000,  50000),
('전기배선', '스위치 교체',           '개',     5000,  25000,  30000),
('전기배선', '분전반 교체',           '식',   400000, 200000, 600000),
('전기배선', '전선 배관 25mm',        'm',      3000,   5000,   8000),
('전기배선', '전기 이설 공사',        '식',   200000, 300000, 500000),
-- 창호
('창호', 'PVC 창호 교체',             'm²',   220000, 130000, 350000),
('창호', '방화문 설치',               '개',   300000, 200000, 500000),
('창호', '시스템창호 이중',           'm²',   350000, 150000, 500000),
('창호', '창호 방풍재 교체',          'm',      5000,   8000,  13000),
-- 목공
('목공', '몰딩 시공',                 'm',      5000,  13000,  18000),
('목공', '걸레받이',                  'm',      3000,   7000,  10000),
('목공', '문틀 제작',                 '개',    80000, 100000, 180000),
('목공', '천장 석고보드',             'm²',    15000,  25000,  40000),
('목공', '벽체 석고보드',             'm²',    12000,  20000,  32000),
-- 도어
('도어', '실내문 ABS 900x2100',       '개',   180000, 100000, 280000),
('도어', '슬라이딩도어',              '개',   220000, 130000, 350000),
('도어', '중문 설치',                 '식',   500000, 300000, 800000),
('도어', '도어 철물 교체',            '개',    20000,  30000,  50000),
-- 타일
('타일', '타일 300x300',              'm²',    30000,  35000,  65000),
('타일', '타일 600x600',              'm²',    40000,  40000,  80000),
('타일', '욕실 타일',                 'm²',    45000,  45000,  90000),
('타일', '현관 타일',                 'm²',    35000,  40000,  75000),
-- 도장
('도장', '내부 도장 2회',             'm²',     4000,  10000,  14000),
('도장', '외부 도장',                 'm²',     8000,  12000,  20000),
('도장', '목공 도장 PU',              'm²',    12000,  18000,  30000),
('도장', '페인트 친환경',             'm²',     6000,  10000,  16000),
-- 필름
('필름', '인테리어 필름 단색',        'm²',    12000,  13000,  25000),
('필름', '인테리어 필름 패턴',        'm²',    18000,  17000,  35000),
('필름', '시트지 시공',               'm²',     8000,  10000,  18000),
-- 도배
('도배', '합지 도배',                 'm²',     3000,   6000,   9000),
('도배', '실크 도배',                 'm²',     5000,   9000,  14000),
('도배', '방염 도배',                 'm²',     7000,  10000,  17000),
-- 욕실도기
('욕실도기', '세면기 도기',           '개',   120000,  80000, 200000),
('욕실도기', '양변기 일체형',         '개',   180000, 120000, 300000),
('욕실도기', '욕조 아크릴 1500',      '개',   250000, 150000, 400000),
('욕실도기', '샤워부스',              '식',   350000, 250000, 600000),
('욕실도기', '수전 교체',             '개',    50000,  50000, 100000),
-- 조명
('조명', 'LED 다운라이트 6인치',      '개',    15000,  20000,  35000),
('조명', '매립등',                    '개',    10000,  15000,  25000),
('조명', '센서등',                    '개',    20000,  20000,  40000),
('조명', '레일조명',                  'm',     15000,  15000,  30000),
-- 바닥
('바닥', '강마루 시공',               'm²',    25000,  30000,  55000),
('바닥', '원목마루 시공',             'm²',    70000,  50000, 120000),
('바닥', '에폭시 도장',               'm²',    15000,  25000,  40000),
('바닥', 'LVT 바닥재',                'm²',    20000,  25000,  45000),
('바닥', '데코타일',                  'm²',    12000,  18000,  30000),
-- 가구
('가구', '붙박이장 1800폭',           '개',   500000, 400000, 900000),
('가구', '주방가구',                  'm',    250000, 150000, 400000),
('가구', '신발장',                    '개',   250000, 150000, 400000),
('가구', '드레스룸',                  '식',   800000, 500000,1300000),
-- 금속
('금속', '스테인리스 핸드레일',       'm',     40000,  40000,  80000),
('금속', '알루미늄 몰딩',             'm',      7000,   8000,  15000),
('금속', '스틸 도어 프레임',          '개',    80000,  70000, 150000),
-- 유리실리콘
('유리실리콘', '창호 실리콘 마감',    'm',      2000,   6000,   8000),
('유리실리콘', '욕실 실리콘 마감',    '식',    20000,  80000, 100000),
('유리실리콘', '강화유리 설치',       'm²',    80000,  70000, 150000),
-- 공조
('공조', '시스템 에어컨 설치',        '대',  1000000, 500000,1500000),
('공조', '환기장치 천장형',           '대',   300000, 200000, 500000),
('공조', '덕트 시공',                 'm',     15000,  15000,  30000),
-- 홈스타일링
('홈스타일링', '커텐 암막',           'm²',    40000,  20000,  60000),
('홈스타일링', '블라인드 롤',         'm²',    25000,  15000,  40000),
('홈스타일링', '거울 설치',           '개',    80000,  70000, 150000),
('홈스타일링', '아트월 시공',         'm²',    50000,  50000, 100000);
