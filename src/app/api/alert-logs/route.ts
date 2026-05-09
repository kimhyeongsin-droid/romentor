import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('sms_alerts')
      .select('*, quotes(quote_number, project_id, projects(name))')
      .order('sent_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    console.error('에러:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
