import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { quoteId, type, itemId } = await req.json()
  const sb = await createClient()

  const { data: quote } = await sb
    .from('quotes')
    .select('*, projects(*)')
    .eq('id', quoteId)
    .single()

  if (!quote) return NextResponse.json({ ok: false, error: '견적을 찾을 수 없습니다.' })

  const project = quote.projects
  let message = ''
  let phone = ''

  if (type === 'payment') {
    phone = quote.client_phone || project.manager_phone
    const dueDate = quote.payment_due_date
      ? new Date(quote.payment_due_date + 'T00:00:00').toLocaleDateString('ko-KR')
      : '미정'
    message = `[로멘토 인테리어]\n안녕하세요, ${project.client_name}님!\n${project.name} 공사 관련 입금 예정일(${dueDate})이 다가왔습니다.\n최종 금액: ${Number(quote.final_amount).toLocaleString()}원\n문의: ${project.manager_phone}`
  } else if (type === 'total') {
    const phones = [project.manager_phone, project.designer_phone, project.site_manager_phone].filter(Boolean)
    phone = phones[0] || project.manager_phone
    message = `[로멘토 견적알람]\n⚠️ 마이너스 발생!\n프로젝트: ${project.name}\n총 이윤: ${Number(quote.total_profit).toLocaleString()}원 (${quote.total_profit_rate}%)\n즉시 확인 바랍니다.`
  } else if (type === 'item') {
    const { data: item } = await sb.from('quote_items').select('*').eq('id', itemId).single()
    phone = project.manager_phone || project.designer_phone || project.site_manager_phone
    message = `[로멘토 견적알람]\n⚠️ 마이너스 공정 발생!\n프로젝트: ${project.name}\n공종: ${item?.work_type}\n항목: ${item?.item_name}\n이윤: ${Number(item?.profit).toLocaleString()}원 (${Number(item?.profit_rate).toFixed(1)}%)\n즉시 확인 바랍니다.`
  }

  if (!phone) return NextResponse.json({ ok: false, error: '수신 번호가 없습니다.' })

  const apiKey = process.env.COOLSMS_API_KEY
  const apiSecret = process.env.COOLSMS_API_SECRET
  const sender = process.env.COOLSMS_SENDER

  if (apiKey && apiSecret && sender) {
    try {
      const crypto = await import('crypto')
      const date = new Date().toISOString()
      const salt = crypto.randomBytes(16).toString('hex')
      const hmacData = date + salt
      const signature = crypto.createHmac('sha256', apiSecret)
        .update(hmacData)
        .digest('hex')

      const res = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        },
        body: JSON.stringify({
          message: {
            to: phone.replace(/-/g, ''),
            from: sender.replace(/-/g, ''),
            text: message,
          }
        }),
      })
      const result = await res.json()
      if (!res.ok) return NextResponse.json({ ok: false, error: JSON.stringify(result) })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message })
    }
  }

  await sb.from('sms_alerts').insert({
    quote_id: quoteId,
    quote_item_id: itemId || null,
    message,
    recipient_phone: phone,
    sent_at: new Date().toISOString(),
    status: 'sent',
  })

  return NextResponse.json({ ok: true, message, phone })
}
