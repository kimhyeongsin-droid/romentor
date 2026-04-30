import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('URL:', url)
    console.log('KEY 앞 10자:', key?.slice(0, 10))

    const res = await fetch(
      `${url}/rest/v1/sms_alerts?select=*,quotes(quote_number,project_id,projects(name))&order=sent_at.desc&limit=200`,
      {
        headers: {
          'apikey': key!,
          'Authorization': `Bearer ${key}`,
        }
      }
    )

    const text = await res.text()
    console.log('Supabase 응답:', res.status, text.slice(0, 200))

    if (!res.ok) return NextResponse.json({ error: text }, { status: 500 })
    return NextResponse.json(JSON.parse(text))
  } catch (e: any) {
    console.error('에러:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
