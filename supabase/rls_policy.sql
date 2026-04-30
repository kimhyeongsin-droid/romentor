-- RLS 활성화
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_alerts ENABLE ROW LEVEL SECURITY;

-- projects: 모든 작업 허용
CREATE POLICY "allow_all_projects" ON projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- quotes: 모든 작업 허용
CREATE POLICY "allow_all_quotes" ON quotes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- quote_items: 모든 작업 허용
CREATE POLICY "allow_all_quote_items" ON quote_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- unit_prices: 모든 작업 허용
CREATE POLICY "allow_all_unit_prices" ON unit_prices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- sms_alerts: 모든 작업 허용
CREATE POLICY "allow_all_sms_alerts" ON sms_alerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
