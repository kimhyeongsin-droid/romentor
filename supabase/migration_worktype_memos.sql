-- ============================================================
-- Migration: 정산 견적의 공종별 메모 저장 테이블
-- 날짜: 2026-05-11
--
-- 변경사항:
--   quote_worktype_memos 테이블 신규 생성
--   - quote_id + work_type 조합으로 UNIQUE
--   - RLS 활성화 + Allow all 정책 + GRANT
--
-- 사용처:
--   정산 견적서의 공종 합계표 메모 입력칸
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_worktype_memos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  work_type  TEXT        NOT NULL,
  memo       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quote_id, work_type)
);

COMMENT ON TABLE quote_worktype_memos IS '정산 견적서의 공종별 메모. 합계표에서 사용.';
COMMENT ON COLUMN quote_worktype_memos.quote_id  IS '해당 견적 ID';
COMMENT ON COLUMN quote_worktype_memos.work_type IS '공종 (예: 가설공사, 철거, 마루철거 등)';
COMMENT ON COLUMN quote_worktype_memos.memo      IS '메모 내용';

-- 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_worktype_memos_quote_id
  ON quote_worktype_memos(quote_id);

-- updated_at 자동 갱신 트리거 (fresh_start.sql의 update_updated_at() 함수 재사용)
DROP TRIGGER IF EXISTS trg_worktype_memos_updated_at ON quote_worktype_memos;
CREATE TRIGGER trg_worktype_memos_updated_at
BEFORE UPDATE ON quote_worktype_memos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- RLS 정책 (migration_rls_policies.sql과 동일 패턴)
ALTER TABLE quote_worktype_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_quote_worktype_memos" ON quote_worktype_memos;
CREATE POLICY "allow_all_quote_worktype_memos"
ON quote_worktype_memos
FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

-- GRANT
GRANT ALL ON quote_worktype_memos TO anon, authenticated;

-- 검증
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'quote_worktype_memos';

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quote_worktype_memos'
ORDER BY ordinal_position;
