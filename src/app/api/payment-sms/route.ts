import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendCoolSms, smsConfig, notifyPhones } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type InRecip = { name?: string; phone?: string }

// 수동 발송: 입금 항목 하나에 대해 지정 수신자에게 즉시 문자 발송.
// body: { scheduleId, message, recipients?: [{name, phone}] }
//   - recipients 가 있으면 그 목록으로, 없으면 프로젝트 고객(알림 ON)으로 발송.
export async function POST(req: Request) {
  const body = await req.json()
  const scheduleId = body?.scheduleId
  const message = body?.message
  const rawRecips: InRecip[] = Array.isArray(body?.recipients) ? body.recipients : []

  if (!scheduleId || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ ok: false, error: '필수 값이 없습니다.' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: row } = await sb
    .from('payment_schedules')
    .select('*, projects(clients)')
    .eq('id', scheduleId)
    .single()
  if (!row) return NextResponse.json({ ok: false, error: '입금 항목을 찾을 수 없습니다.' })

  let recips = rawRecips
    .filter(r => r && typeof r.phone === 'string' && r.phone.trim().length > 0)
    .map(r => ({ name: r.name ?? '', phone: (r.phone as string).trim() }))
  if (recips.length === 0) {
    recips = notifyPhones((row as { projects?: { clients?: unknown } }).projects?.clients)
  }
  if (recips.length === 0) {
    return NextResponse.json({ ok: false, error: '받는 사람이 없습니다.' })
  }

  const cfg = smsConfig()
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const r of recips) {
    let status: 'sent' | 'failed' = 'sent'
    if (cfg) {
      try {
        await sendCoolSms(r.phone, message, cfg)
      } catch (e) {
        status = 'failed'
        failed++
        errors.push(`${r.phone}: ${(e as Error).message}`)
      }
    }
    if (status === 'sent') sent++

    await sb.from('sms_alerts').insert({
      project_id: row.project_id,
      payment_schedule_id: row.id,
      type: 'payment_reminder',
      message,
      recipient_phone: r.phone,
      status,
      sent_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    smsConfigured: !!cfg,
    error: errors.join('; ') || undefined,
  })
}
