-- 프로젝트 테이블
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  address TEXT,
  area_sqm NUMERIC(10,2),
  manager_name TEXT NOT NULL,
  manager_phone TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 단가 마스터 테이블
CREATE TABLE unit_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_type TEXT NOT NULL CHECK (work_type IN ('철거','바닥','벽체','목공','천장','도장','전기','설비','창호','가구')),
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '식',
  unit_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적서 테이블
CREATE TABLE quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  version INTEGER DEFAULT 1,
  total_quote_amount NUMERIC(15,0) DEFAULT 0,
  total_execution_amount NUMERIC(15,0) DEFAULT 0,
  total_profit NUMERIC(15,0) DEFAULT 0,
  total_profit_rate NUMERIC(6,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'executed')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적 항목 테이블
CREATE TABLE quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL CHECK (work_type IN ('철거','바닥','벽체','목공','천장','도장','전기','설비','창호','가구')),
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '식',
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,0) DEFAULT 0,
  quote_amount NUMERIC(15,0) GENERATED ALWAYS AS (FLOOR(quantity * unit_price)) STORED,
  execution_amount NUMERIC(15,0) DEFAULT 0,
  profit NUMERIC(15,0) GENERATED ALWAYS AS (FLOOR(quantity * unit_price) - execution_amount) STORED,
  profit_rate NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN FLOOR(quantity * unit_price) = 0 THEN 0
    ELSE ROUND(((FLOOR(quantity * unit_price) - execution_amount)::NUMERIC / FLOOR(quantity * unit_price)) * 100, 2)
    END
  ) STORED,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS 알람 로그 테이블
CREATE TABLE sms_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE SET NULL,
  work_type TEXT,
  message TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 견적 합계 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quotes SET
    total_quote_amount = (
      SELECT COALESCE(SUM(quote_amount), 0) FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ),
    total_execution_amount = (
      SELECT COALESCE(SUM(execution_amount), 0) FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ),
    total_profit = (
      SELECT COALESCE(SUM(profit), 0) FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ),
    total_profit_rate = (
      SELECT CASE WHEN COALESCE(SUM(quote_amount), 0) = 0 THEN 0
        ELSE ROUND((COALESCE(SUM(profit), 0)::NUMERIC / COALESCE(SUM(quote_amount), 0)) * 100, 2)
      END FROM quote_items WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW EXECUTE FUNCTION update_quote_totals();

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_unit_prices_updated_at BEFORE UPDATE ON unit_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quote_items_updated_at BEFORE UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 샘플 단가 데이터
INSERT INTO unit_prices (work_type, item_name, unit, unit_price) VALUES
('철거', '바닥재 철거', 'm²', 15000),
('철거', '벽체 타일 철거', 'm²', 20000),
('철거', '천장 철거', 'm²', 18000),
('철거', '문짝 철거', '개', 30000),
('바닥', '강마루 시공', 'm²', 45000),
('바닥', '타일 시공 (300x300)', 'm²', 55000),
('바닥', '에폭시 도장', 'm²', 35000),
('벽체', '도배 (합지)', 'm²', 8000),
('벽체', '도배 (실크)', 'm²', 12000),
('벽체', '타일 시공', 'm²', 60000),
('목공', '몰딩 시공', 'm', 15000),
('목공', '걸레받이', 'm', 8000),
('목공', '문틀 제작', '개', 150000),
('천장', '석고보드 천장', 'm²', 35000),
('천장', '텍스 천장', 'm²', 25000),
('도장', '내부 도장 (2회)', 'm²', 12000),
('도장', '외부 도장', 'm²', 18000),
('전기', '콘센트 이설', '개', 45000),
('전기', '조명 설치', '개', 30000),
('전기', '분전반 교체', '식', 500000),
('설비', '세면대 교체', '개', 250000),
('설비', '변기 교체', '개', 300000),
('설비', '보일러 교체', '식', 800000),
('창호', 'PVC 창호 교체', 'm²', 250000),
('창호', '방화문 설치', '개', 400000),
('가구', '붙박이장 (1800폭)', '개', 800000),
('가구', '주방가구', 'm', 350000);
