const { createClient } = require('@supabase/supabase-js')
const sb = createClient('https://rvkpwclnmwzsulomoppq.supabase.co', 'sb_publishable_KOTn-tsQ5j0g0ZUbpJXNzw_8jTLmSpB')

async function main() {
  const { data } = await sb.from('quote_items').select('*').limit(1)
  if (data && data[0] && 'comment' in data[0]) {
    console.log('✅ comment 컬럼 이미 존재')
    return
  }
  console.log('❌ quote_items에 comment 컬럼이 없습니다.')
  console.log('Supabase 대시보드에서 실행하세요:')
  console.log('ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT \'\';')
  console.log('URL: https://supabase.com/dashboard/project/rvkpwclnmwzsulomoppq/editor')
}
main()
