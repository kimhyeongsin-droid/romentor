-- ============================================================
-- fresh_start.sql — 로멘토 DB 완전 초기 설치
-- Supabase SQL Editor에서 한 번에 실행하세요.
-- ============================================================

-- ── 1. 기존 테이블/함수 완전 제거 ───────────────────────────
DROP TABLE IF EXISTS sms_alerts   CASCADE;
DROP TABLE IF EXISTS quote_items  CASCADE;
DROP TABLE IF EXISTS quotes       CASCADE;
DROP TABLE IF EXISTS unit_prices  CASCADE;
DROP TABLE IF EXISTS projects     CASCADE;

DROP FUNCTION IF EXISTS update_quote_totals()      CASCADE;
DROP FUNCTION IF EXISTS recalc_final_on_discount() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()        CASCADE;

-- ── 2. projects 테이블 ───────────────────────────────────────
CREATE TABLE projects (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  client_name  TEXT        NOT NULL,
  address      TEXT,
  area_sqm     NUMERIC(10,2),
  manager_name TEXT        NOT NULL,
  manager_phone TEXT       NOT NULL,
  status       TEXT        DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. unit_prices 테이블 ───────────────────────────────────
CREATE TABLE unit_prices (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  work_type           TEXT        NOT NULL CHECK (work_type IN (
    '가설공사','철거','마루철거','설비','전기배선',
    '창호','목공','도어','타일','도장',
    '필름','도배','욕실도기','조명','바닥',
    '가구','금속','유리실리콘','공조','홈스타일링'
  )),
  item_name           TEXT        NOT NULL,
  unit                TEXT        NOT NULL DEFAULT '식',
  material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0,
  unit_price          NUMERIC(15,0) NOT NULL DEFAULT 0,
  description         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. quotes 테이블 ─────────────────────────────────────────
CREATE TABLE quotes (
  id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id                  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_number                TEXT        NOT NULL UNIQUE,
  version                     INTEGER     DEFAULT 1,
  status                      TEXT        DEFAULT 'draft' CHECK (status IN ('draft','confirmed','executed')),
  note                        TEXT,
  -- 직접공사비
  total_material_amount       NUMERIC(15,0) DEFAULT 0,
  total_labor_amount          NUMERIC(15,0) DEFAULT 0,
  total_quote_amount          NUMERIC(15,0) DEFAULT 0,
  total_execution_amount      NUMERIC(15,0) DEFAULT 0,
  total_profit                NUMERIC(15,0) DEFAULT 0,
  total_profit_rate           NUMERIC(6,2)  DEFAULT 0,
  -- 간접공사비
  indirect_accident_insurance   NUMERIC(15,0) DEFAULT 0,
  indirect_employment_insurance NUMERIC(15,0) DEFAULT 0,
  indirect_overhead             NUMERIC(15,0) DEFAULT 0,
  indirect_profit_margin        NUMERIC(15,0) DEFAULT 0,
  total_indirect_cost           NUMERIC(15,0) DEFAULT 0,
  -- 최종금액
  vat_amount                  NUMERIC(15,0) DEFAULT 0,
  discount_amount             NUMERIC(15,0) DEFAULT 0,
  final_amount                NUMERIC(15,0) DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. quote_items 테이블 ────────────────────────────────────
CREATE TABLE quote_items (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id            UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  work_type           TEXT        NOT NULL CHECK (work_type IN (
    '가설공사','철거','마루철거','설비','전기배선',
    '창호','목공','도어','타일','도장',
    '필름','도배','욕실도기','조명','바닥',
    '가구','금속','유리실리콘','공조','홈스타일링'
  )),
  item_name           TEXT        NOT NULL,
  unit                TEXT        NOT NULL DEFAULT '식',
  quantity            NUMERIC(10,2) DEFAULT 1,
  unit_price          NUMERIC(15,0) DEFAULT 0,
  -- 입력 단가
  material_unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  labor_unit_price    NUMERIC(15,0) NOT NULL DEFAULT 0,
  -- 자동 계산 (GENERATED)
  material_amount     NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price)
  ) STORED,
  labor_amount        NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * labor_unit_price)
  ) STORED,
  quote_amount        NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price)
  ) STORED,
  -- 실행금액은 수동 입력
  execution_amount    NUMERIC(15,0) DEFAULT 0,
  -- 이윤/이윤율 자동 계산
  profit              NUMERIC(15,0) GENERATED ALWAYS AS (
    FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price) - execution_amount
  ) STORED,
  profit_rate         NUMERIC(6,2)  GENERATED ALWAYS AS (
    CASE
      WHEN (FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price)) = 0 THEN 0
      ELSE ROUND(
        ((FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price) - execution_amount)::NUMERIC
          / (FLOOR(quantity * material_unit_price) + FLOOR(quantity * labor_unit_price))) * 100, 2
      )
    END
  ) STORED,
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. sms_alerts 테이블 ────────────────────────────────────
CREATE TABLE sms_alerts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id        UUID        REFERENCES quotes(id) ON DELETE SET NULL,
  quote_item_id   UUID        REFERENCES quote_items(id) ON DELETE SET NULL,
  work_type       TEXT,
  message         TEXT        NOT NULL,
  recipient_phone TEXT        NOT NULL,
  status          TEXT        DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. RLS 활성화 ─────────────────────────────────────────────
ALTER TABLE projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_alerts  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_projects"    ON projects    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_unit_prices" ON unit_prices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_quotes"      ON quotes      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_quote_items" ON quote_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sms_alerts"  ON sms_alerts  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── 8. 트리거 함수 (DECLARE 없이 서브쿼리만 사용) ───────────

-- 8-a. quote_items 변경 시 quotes 합계 자동 갱신
CREATE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quotes SET
    total_material_amount =
      (SELECT COALESCE(SUM(material_amount), 0)  FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    total_labor_amount =
      (SELECT COALESCE(SUM(labor_amount), 0)     FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    total_quote_amount =
      (SELECT COALESCE(SUM(quote_amount), 0)     FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    total_execution_amount =
      (SELECT COALESCE(SUM(execution_amount), 0) FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    total_profit =
      (SELECT COALESCE(SUM(quote_amount), 0) - COALESCE(SUM(execution_amount), 0)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    total_profit_rate =
      (SELECT CASE WHEN COALESCE(SUM(quote_amount), 0) = 0 THEN 0
        ELSE ROUND(((COALESCE(SUM(quote_amount), 0) - COALESCE(SUM(execution_amount), 0))::NUMERIC
          / COALESCE(SUM(quote_amount), 0)) * 100, 2)
       END FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    indirect_accident_insurance =
      (SELECT FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0378)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    indirect_employment_insurance =
      (SELECT FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0205)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    indirect_overhead =
      (SELECT FLOOR(COALESCE(SUM(quote_amount), 0) * 0.05)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    indirect_profit_margin =
      (SELECT FLOOR(COALESCE(SUM(quote_amount), 0) * 0.15)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    total_indirect_cost =
      (SELECT FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0378)
            + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0205)
            + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.05)
            + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.15)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    vat_amount =
      (SELECT FLOOR((
          COALESCE(SUM(quote_amount), 0)
          + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0378)
          + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0205)
          + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.05)
          + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.15)
        ) * 0.1)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    final_amount =
      (SELECT
          COALESCE(SUM(quote_amount), 0)
          + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0378)
          + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0205)
          + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.05)
          + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.15)
          + FLOOR((
              COALESCE(SUM(quote_amount), 0)
              + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0378)
              + FLOOR(COALESCE(SUM(labor_amount), 0) * 0.0205)
              + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.05)
              + FLOOR(COALESCE(SUM(quote_amount), 0) * 0.15)
            ) * 0.1)
          - COALESCE((SELECT discount_amount FROM quotes WHERE id = COALESCE(NEW.quote_id, OLD.quote_id)), 0)
       FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW EXECUTE FUNCTION update_quote_totals();

-- 8-b. discount_amount 변경 시 final_amount 재계산
CREATE FUNCTION recalc_final_on_discount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_amount := NEW.total_quote_amount + NEW.total_indirect_cost + NEW.vat_amount - NEW.discount_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quotes_discount
BEFORE UPDATE OF discount_amount ON quotes
FOR EACH ROW EXECUTE FUNCTION recalc_final_on_discount();

-- 8-c. updated_at 자동 갱신
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at    BEFORE UPDATE ON projects    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_unit_prices_updated_at BEFORE UPDATE ON unit_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated_at      BEFORE UPDATE ON quotes      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quote_items_updated_at BEFORE UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 9. 단가 샘플 데이터 ──────────────────────────────────────
INSERT INTO unit_prices (work_type, item_name, unit, material_unit_price, labor_unit_price, unit_price) VALUES
-- 가설공사
('가설공사', '가설울타리',           'm',       3000,   5000,   8000),
('가설공사', '가설사무실',           '식',    300000, 200000, 500000),
('가설공사', '안전시설 설치',        '식',    200000, 150000, 350000),
-- 철거
('철거', '바닥재 철거',              'm²',     3000,  15000,  18000),
('철거', '벽체 타일 철거',           'm²',     5000,  17000,  22000),
('철거', '천장 철거',                'm²',     3000,  17000,  20000),
('철거', '문짝 철거',                '개',     5000,  30000,  35000),
('철거', '벽체 철거 (조적)',         'm²',     8000,  22000,  30000),
-- 마루철거
('마루철거', '강마루 철거',          'm²',     2000,  10000,  12000),
('마루철거', '원목마루 철거',        'm²',     3000,  12000,  15000),
('마루철거', '장판 철거',            'm²',     1000,   6000,   7000),
-- 설비
('설비', '세면대 교체',              '개',   150000, 150000, 300000),
('설비', '변기 교체',                '개',   200000, 150000, 350000),
('설비', '보일러 교체',              '식',   800000, 400000,1200000),
('설비', '욕조 설치',                '개',   300000, 200000, 500000),
('설비', '배관 이설',                'm',     15000,  25000,  40000),
-- 전기배선
('전기배선', '콘센트 이설',          '개',    10000,  40000,  50000),
('전기배선', '스위치 교체',          '개',     5000,  25000,  30000),
('전기배선', '분전반 교체',          '식',   400000, 200000, 600000),
('전기배선', '전선 배관 25mm',       'm',      3000,   5000,   8000),
('전기배선', '전기 이설 공사',       '식',   200000, 300000, 500000),
-- 창호
('창호', 'PVC 창호 교체',            'm²',   220000, 130000, 350000),
('창호', '방화문 설치',              '개',   300000, 200000, 500000),
('창호', '시스템창호 이중',          'm²',   350000, 150000, 500000),
('창호', '창호 방풍재 교체',         'm',      5000,   8000,  13000),
-- 목공
('목공', '몰딩 시공',                'm',      5000,  13000,  18000),
('목공', '걸레받이',                 'm',      3000,   7000,  10000),
('목공', '문틀 제작',                '개',    80000, 100000, 180000),
('목공', '천장 석고보드',            'm²',    15000,  25000,  40000),
('목공', '벽체 석고보드',            'm²',    12000,  20000,  32000),
-- 도어
('도어', '실내문 ABS 900x2100',      '개',   180000, 100000, 280000),
('도어', '슬라이딩도어',             '개',   220000, 130000, 350000),
('도어', '중문 설치',                '식',   500000, 300000, 800000),
('도어', '도어 철물 교체',           '개',    20000,  30000,  50000),
-- 타일
('타일', '타일 300x300',             'm²',    30000,  35000,  65000),
('타일', '타일 600x600',             'm²',    40000,  40000,  80000),
('타일', '욕실 타일',                'm²',    45000,  45000,  90000),
('타일', '현관 타일',                'm²',    35000,  40000,  75000),
-- 도장
('도장', '내부 도장 2회',            'm²',     4000,  10000,  14000),
('도장', '외부 도장',                'm²',     8000,  12000,  20000),
('도장', '목공 도장 PU',             'm²',    12000,  18000,  30000),
('도장', '페인트 친환경',            'm²',     6000,  10000,  16000),
-- 필름
('필름', '인테리어 필름 단색',       'm²',    12000,  13000,  25000),
('필름', '인테리어 필름 패턴',       'm²',    18000,  17000,  35000),
('필름', '시트지 시공',              'm²',     8000,  10000,  18000),
-- 도배
('도배', '합지 도배',                'm²',     3000,   6000,   9000),
('도배', '실크 도배',                'm²',     5000,   9000,  14000),
('도배', '방염 도배',                'm²',     7000,  10000,  17000),
-- 욕실도기
('욕실도기', '세면기 도기',          '개',   120000,  80000, 200000),
('욕실도기', '양변기 일체형',        '개',   180000, 120000, 300000),
('욕실도기', '욕조 아크릴 1500',     '개',   250000, 150000, 400000),
('욕실도기', '샤워부스',             '식',   350000, 250000, 600000),
('욕실도기', '수전 교체',            '개',    50000,  50000, 100000),
-- 조명
('조명', 'LED 다운라이트 6인치',     '개',    15000,  20000,  35000),
('조명', '매립등',                   '개',    10000,  15000,  25000),
('조명', '센서등',                   '개',    20000,  20000,  40000),
('조명', '레일조명',                 'm',     15000,  15000,  30000),
-- 바닥
('바닥', '강마루 시공',              'm²',    25000,  30000,  55000),
('바닥', '원목마루 시공',            'm²',    70000,  50000, 120000),
('바닥', '에폭시 도장',              'm²',    15000,  25000,  40000),
('바닥', 'LVT 바닥재',               'm²',    20000,  25000,  45000),
('바닥', '데코타일',                 'm²',    12000,  18000,  30000),
-- 가구
('가구', '붙박이장 1800폭',          '개',   500000, 400000, 900000),
('가구', '주방가구',                 'm',    250000, 150000, 400000),
('가구', '신발장',                   '개',   250000, 150000, 400000),
('가구', '드레스룸',                 '식',   800000, 500000,1300000),
-- 금속
('금속', '스테인리스 핸드레일',      'm',     40000,  40000,  80000),
('금속', '알루미늄 몰딩',            'm',      7000,   8000,  15000),
('금속', '스틸 도어 프레임',         '개',    80000,  70000, 150000),
-- 유리실리콘
('유리실리콘', '창호 실리콘 마감',   'm',      2000,   6000,   8000),
('유리실리콘', '욕실 실리콘 마감',   '식',    20000,  80000, 100000),
('유리실리콘', '강화유리 설치',      'm²',    80000,  70000, 150000),
-- 공조
('공조', '시스템 에어컨 설치',       '대',  1000000, 500000,1500000),
('공조', '환기장치 천장형',          '대',   300000, 200000, 500000),
('공조', '덕트 시공',                'm',     15000,  15000,  30000),
-- 홈스타일링
('홈스타일링', '커텐 암막',          'm²',    40000,  20000,  60000),
('홈스타일링', '블라인드 롤',        'm²',    25000,  15000,  40000),
('홈스타일링', '거울 설치',          '개',    80000,  70000, 150000),
('홈스타일링', '아트월 시공',        'm²',    50000,  50000, 100000);

-- ── 10. 설치 확인 ────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name IN ('projects','unit_prices','quotes','quote_items','sms_alerts')
     AND table_schema = 'public')                                      AS tables_ok,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'quote_items' AND column_name = 'quote_amount'
     AND table_schema = 'public')                                      AS quote_amount_ok,
  (SELECT COUNT(*) FROM information_schema.routines
   WHERE routine_name = 'update_quote_totals'
     AND routine_schema = 'public')                                    AS trigger_fn_ok,
  (SELECT COUNT(*) FROM unit_prices)                                   AS unit_price_rows;
